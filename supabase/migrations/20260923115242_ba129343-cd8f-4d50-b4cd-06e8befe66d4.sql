-- Permitir a la función de rectificación saltar el bloqueo de orden cerrada
CREATE OR REPLACE FUNCTION public.bloquear_orden_cerrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.rectificando_orden', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado IN ('cerrada','rectificada') THEN
    IF NEW.estado NOT IN ('cerrada','rectificada') THEN
      RAISE EXCEPTION 'Orden % está %; no puede modificarse (solo rectificación permitida)', OLD.id, OLD.estado;
    END IF;
    IF OLD.estado = 'cerrada' AND NEW.estado = 'cerrada' THEN
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

-- Rectificación atómica de una orden logística cerrada
CREATE OR REPLACE FUNCTION public.rectificar_orden_logistica(
  _orden_id uuid,
  _modo text,
  _motivo text,
  _cambios jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_orden public.ordenes_logisticas%ROWTYPE;
  v_antes jsonb;
  v_despues jsonb;
  v_perm text;
  v_perm_ok boolean;
  v_now timestamptz := now();
  v_mov public.movimientos%ROWTYPE;
  v_nuevo_mov uuid;
  v_litros numeric;
  v_grado numeric;
  v_dep_origen text;
  v_dep_destino text;
  v_producto uuid;
  v_lote uuid;
  v_cc uuid;
  v_cv uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _modo NOT IN ('informativa','operativa') THEN
    RAISE EXCEPTION 'Modo de rectificación no válido: %', _modo;
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 10 THEN
    RAISE EXCEPTION 'Debe indicar un motivo de rectificación (mínimo 10 caracteres)';
  END IF;

  SELECT * INTO v_orden FROM public.ordenes_logisticas WHERE id = _orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no encontrada', _orden_id; END IF;

  IF v_orden.estado NOT IN ('cerrada','rectificada','completada') THEN
    RAISE EXCEPTION 'Solo se pueden rectificar órdenes cerradas o completadas (estado actual: %)', v_orden.estado;
  END IF;

  v_perm := CASE WHEN v_orden.tipo = 'carga' THEN 'ordenes.carga.rectificar' ELSE 'ordenes.descarga.rectificar' END;
  SELECT public.has_permission(v_orden.bodega_id, v_perm) INTO v_perm_ok;
  IF NOT coalesce(v_perm_ok, false) THEN
    RAISE EXCEPTION 'Permiso denegado: %', v_perm;
  END IF;

  v_antes := to_jsonb(v_orden);

  PERFORM set_config('app.rectificando_orden', 'on', true);

  IF _modo = 'informativa' THEN
    UPDATE public.ordenes_logisticas SET
      transportista        = COALESCE(_cambios->>'transportista', transportista),
      empresa_transportista= COALESCE(_cambios->>'empresa_transportista', empresa_transportista),
      matricula            = COALESCE(_cambios->>'matricula', matricula),
      remolque_matricula   = COALESCE(_cambios->>'remolque_matricula', remolque_matricula),
      conductor_nombre     = COALESCE(_cambios->>'conductor_nombre', conductor_nombre),
      conductor_documento  = COALESCE(_cambios->>'conductor_documento', conductor_documento),
      conductor_telefono   = COALESCE(_cambios->>'conductor_telefono', conductor_telefono),
      numero_precinto      = COALESCE(_cambios->>'numero_precinto', numero_precinto),
      precintos_adicionales= COALESCE(_cambios->>'precintos_adicionales', precintos_adicionales),
      numero_operacion     = COALESCE(_cambios->>'numero_operacion', numero_operacion),
      observaciones        = COALESCE(_cambios->>'observaciones', observaciones),
      motivo_rectificacion = _motivo,
      rectificada_por      = v_user,
      rectificada_at       = v_now,
      updated_by           = v_user,
      updated_at           = v_now
    WHERE id = _orden_id
    RETURNING to_jsonb(ordenes_logisticas.*) INTO v_despues;

    PERFORM set_config('app.rectificando_orden', 'off', true);

    INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
    VALUES (v_orden.bodega_id, v_user, 'ORDEN_RECTIFICADA_INFORMATIVA', 'ordenes_logisticas', _orden_id::text,
      jsonb_build_object('motivo', _motivo, 'modo', 'informativa', 'anterior', v_antes, 'nuevo', v_despues));

    RETURN jsonb_build_object('ok', true, 'modo', 'informativa', 'movimiento_id', v_orden.movimiento_id, 'estado', v_orden.estado);
  END IF;

  -- === MODO OPERATIVO ===
  IF v_orden.movimiento_id IS NULL THEN
    RAISE EXCEPTION 'La orden no tiene movimiento asociado; no procede rectificación operativa';
  END IF;

  SELECT * INTO v_mov FROM public.movimientos WHERE id = v_orden.movimiento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento original no encontrado'; END IF;
  IF v_mov.estado_movimiento <> 'activo' THEN
    RAISE EXCEPTION 'El movimiento original ya no está activo (estado: %)', v_mov.estado_movimiento;
  END IF;

  v_litros      := COALESCE((_cambios->>'litros_reales')::numeric, v_orden.litros_reales);
  v_grado       := COALESCE((_cambios->>'grado')::numeric, v_orden.grado);
  v_dep_origen  := COALESCE(NULLIF(_cambios->>'deposito_origen_id',''), v_orden.deposito_origen_id);
  v_dep_destino := COALESCE(NULLIF(_cambios->>'deposito_destino_id',''), v_orden.deposito_destino_id);
  v_producto    := COALESCE(NULLIF(_cambios->>'producto_id','')::uuid, v_orden.producto_id);
  v_lote        := COALESCE(NULLIF(_cambios->>'lote_id','')::uuid, v_orden.lote_id);
  v_cc          := COALESCE(NULLIF(_cambios->>'contrato_compra_id','')::uuid, v_orden.contrato_compra_id);
  v_cv          := COALESCE(NULLIF(_cambios->>'contrato_venta_id','')::uuid, v_orden.contrato_venta_id);

  IF v_litros IS NULL OR v_litros <= 0 THEN RAISE EXCEPTION 'Litros rectificados inválidos'; END IF;
  IF v_producto IS NULL THEN RAISE EXCEPTION 'Producto obligatorio'; END IF;
  IF v_orden.tipo = 'carga' AND v_dep_origen IS NULL THEN RAISE EXCEPTION 'Depósito origen obligatorio en carga'; END IF;
  IF v_orden.tipo = 'descarga' AND v_dep_destino IS NULL THEN RAISE EXCEPTION 'Depósito destino obligatorio en descarga'; END IF;

  -- 1) Marcar el movimiento original como corregido (libera stock y saldos)
  UPDATE public.movimientos
     SET estado_movimiento = 'corregido',
         motivo_correccion = _motivo,
         corregido_por = v_user,
         corregido_en = v_now,
         updated_by = v_user,
         updated_at = v_now
   WHERE id = v_mov.id;

  -- 2) Crear el movimiento corregido enlazado al original
  INSERT INTO public.movimientos (
    bodega_id, tipo, fecha, hora,
    deposito_origen_id, deposito_destino_id,
    producto_id, lote_id, litros, grado,
    observaciones, trabajo_id,
    contrato_compra_id, contrato_venta_id,
    movimiento_original_id, created_by, estado_movimiento
  ) VALUES (
    v_mov.bodega_id, v_mov.tipo, v_mov.fecha, v_mov.hora,
    v_dep_origen, v_dep_destino,
    v_producto, v_lote, v_litros, v_grado,
    COALESCE(v_mov.observaciones,'') || ' · Rectificado: ' || _motivo,
    v_mov.trabajo_id,
    CASE WHEN v_orden.tipo = 'descarga' THEN v_cc ELSE NULL END,
    CASE WHEN v_orden.tipo = 'carga'    THEN v_cv ELSE NULL END,
    v_mov.id, v_user, 'activo'
  ) RETURNING id INTO v_nuevo_mov;

  -- 3) Actualizar la orden
  UPDATE public.ordenes_logisticas SET
    estado               = 'rectificada',
    litros_reales        = v_litros,
    grado                = v_grado,
    deposito_origen_id   = v_dep_origen,
    deposito_destino_id  = v_dep_destino,
    producto_id          = v_producto,
    lote_id              = v_lote,
    contrato_compra_id   = v_cc,
    contrato_venta_id    = v_cv,
    movimiento_id        = v_nuevo_mov,
    motivo_rectificacion = _motivo,
    rectificada_por      = v_user,
    rectificada_at       = v_now,
    updated_by           = v_user,
    updated_at           = v_now
  WHERE id = _orden_id
  RETURNING to_jsonb(ordenes_logisticas.*) INTO v_despues;

  PERFORM set_config('app.rectificando_orden', 'off', true);

  INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
  VALUES (v_orden.bodega_id, v_user, 'ORDEN_RECTIFICADA_OPERATIVA', 'ordenes_logisticas', _orden_id::text,
    jsonb_build_object(
      'motivo', _motivo,
      'modo', 'operativa',
      'movimiento_anterior', v_mov.id,
      'movimiento_nuevo', v_nuevo_mov,
      'anterior', v_antes,
      'nuevo', v_despues
    ));

  RETURN jsonb_build_object(
    'ok', true, 'modo', 'operativa',
    'movimiento_anterior', v_mov.id,
    'movimiento_id', v_nuevo_mov,
    'estado', 'rectificada'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.rectificar_orden_logistica(uuid, text, text, jsonb) TO authenticated;