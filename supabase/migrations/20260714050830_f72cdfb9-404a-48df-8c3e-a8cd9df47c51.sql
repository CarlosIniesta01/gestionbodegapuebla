
-- Trigger: bloquear cambios sobre órdenes cerradas / rectificadas
CREATE OR REPLACE FUNCTION public.bloquear_orden_cerrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.estado IN ('cerrada','rectificada') THEN
    -- Solo se permite pasar a 'rectificada' o actualizar campos de rectificación/audit
    IF NEW.estado NOT IN ('cerrada','rectificada') THEN
      RAISE EXCEPTION 'Orden % está %; no puede modificarse (solo rectificación permitida)', OLD.id, OLD.estado;
    END IF;
    IF OLD.estado = 'cerrada' AND NEW.estado = 'cerrada' THEN
      -- Permitimos únicamente marcar como rectificada o tocar campos de auditoría
      IF (OLD.movimiento_id IS DISTINCT FROM NEW.movimiento_id)
         OR (OLD.litros_reales IS DISTINCT FROM NEW.litros_reales)
         OR (OLD.producto_id IS DISTINCT FROM NEW.producto_id)
         OR (OLD.deposito_origen_id IS DISTINCT FROM NEW.deposito_origen_id)
         OR (OLD.deposito_destino_id IS DISTINCT FROM NEW.deposito_destino_id)
         OR (OLD.tipo IS DISTINCT FROM NEW.tipo) THEN
        RAISE EXCEPTION 'La orden % está cerrada; campos operativos son inmutables', OLD.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_orden_cerrada ON public.ordenes_logisticas;
CREATE TRIGGER trg_bloquear_orden_cerrada
BEFORE UPDATE ON public.ordenes_logisticas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_orden_cerrada();

-- Función atómica de confirmación
CREATE OR REPLACE FUNCTION public.confirmar_orden_logistica(
  _orden_id uuid,
  _idempotency_key uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_orden public.ordenes_logisticas%ROWTYPE;
  v_perm text;
  v_perm_ok boolean;
  v_mov_id uuid;
  v_now timestamptz := now();
  v_fecha date;
  v_hora time;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Bloquear fila
  SELECT * INTO v_orden FROM public.ordenes_logisticas WHERE id = _orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no encontrada', _orden_id; END IF;

  -- Idempotencia por movimiento ya asociado
  IF v_orden.movimiento_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'movimiento_id', v_orden.movimiento_id,
      'estado', v_orden.estado
    );
  END IF;

  -- Idempotencia por clave suministrada
  IF _idempotency_key IS NOT NULL AND v_orden.idempotency_key IS NOT NULL
     AND v_orden.idempotency_key = _idempotency_key
     AND v_orden.estado IN ('cerrada','rectificada') THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'movimiento_id', v_orden.movimiento_id, 'estado', v_orden.estado);
  END IF;

  IF v_orden.estado <> 'pendiente_confirmacion' THEN
    RAISE EXCEPTION 'La orden debe estar en estado pendiente_confirmacion (actual: %)', v_orden.estado;
  END IF;

  -- Permiso granular
  v_perm := CASE WHEN v_orden.tipo = 'carga' THEN 'ordenes.carga.confirmar' ELSE 'ordenes.descarga.confirmar' END;
  SELECT public.has_permission(v_orden.bodega_id, v_perm) INTO v_perm_ok;
  IF NOT v_perm_ok THEN
    RAISE EXCEPTION 'Permiso denegado: %', v_perm;
  END IF;

  -- Validaciones mínimas antes de tocar existencias
  IF v_orden.producto_id IS NULL THEN RAISE EXCEPTION 'Producto obligatorio'; END IF;
  IF v_orden.litros_reales IS NULL OR v_orden.litros_reales <= 0 THEN RAISE EXCEPTION 'Litros reales inválidos'; END IF;
  IF v_orden.tipo = 'carga' AND v_orden.deposito_origen_id IS NULL THEN RAISE EXCEPTION 'Depósito origen obligatorio en carga'; END IF;
  IF v_orden.tipo = 'descarga' AND v_orden.deposito_destino_id IS NULL THEN RAISE EXCEPTION 'Depósito destino obligatorio en descarga'; END IF;
  IF v_orden.lab_estado <> 'autorizado' THEN RAISE EXCEPTION 'Laboratorio no ha autorizado la orden'; END IF;

  v_fecha := COALESCE(v_orden.fecha_fin_real::date, v_orden.fecha_programada, CURRENT_DATE);
  v_hora  := COALESCE(v_orden.fecha_fin_real::time, v_orden.hora_programada, CURRENT_TIME);

  -- Crear movimiento (los triggers validan contrato y recalculan stock/contratos)
  INSERT INTO public.movimientos (
    bodega_id, tipo, fecha, hora,
    deposito_origen_id, deposito_destino_id,
    producto_id, lote_id, litros, grado,
    observaciones, trabajo_id,
    contrato_compra_id, contrato_venta_id,
    created_by, estado_movimiento
  ) VALUES (
    v_orden.bodega_id,
    CASE WHEN v_orden.tipo = 'carga' THEN 'salida'::text ELSE 'entrada'::text END::movimiento_tipo,
    v_fecha, v_hora,
    v_orden.deposito_origen_id, v_orden.deposito_destino_id,
    v_orden.producto_id, v_orden.lote_id,
    v_orden.litros_reales, v_orden.grado,
    COALESCE(v_orden.observaciones, 'Orden ' || v_orden.tipo::text || ' ' || COALESCE(v_orden.numero_operacion,'')),
    v_orden.trabajo_id,
    CASE WHEN v_orden.tipo = 'descarga' THEN v_orden.contrato_compra_id ELSE NULL END,
    CASE WHEN v_orden.tipo = 'carga'    THEN v_orden.contrato_venta_id  ELSE NULL END,
    v_user, 'activo'
  ) RETURNING id INTO v_mov_id;

  -- Actualizar orden a cerrada + enlace movimiento
  UPDATE public.ordenes_logisticas
     SET estado = 'cerrada',
         movimiento_id = v_mov_id,
         confirmado_por = v_user,
         confirmado_at = v_now,
         cerrada_at = v_now,
         idempotency_key = COALESCE(_idempotency_key, idempotency_key, gen_random_uuid()),
         updated_by = v_user,
         updated_at = v_now
   WHERE id = _orden_id;

  -- Auditoría
  INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
  VALUES (
    v_orden.bodega_id, v_user, 'ORDEN_CONFIRMADA', 'ordenes_logisticas', _orden_id::text,
    jsonb_build_object(
      'movimiento_id', v_mov_id,
      'tipo', v_orden.tipo,
      'litros', v_orden.litros_reales,
      'producto_id', v_orden.producto_id,
      'contrato_compra_id', v_orden.contrato_compra_id,
      'contrato_venta_id', v_orden.contrato_venta_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'movimiento_id', v_mov_id, 'estado', 'cerrada');
END $$;

GRANT EXECUTE ON FUNCTION public.confirmar_orden_logistica(uuid, uuid) TO authenticated;
