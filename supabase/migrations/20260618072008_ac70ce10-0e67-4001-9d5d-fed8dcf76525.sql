
-- =====================================================
-- FASE 3 — Productos enológicos, lotes y consumos trazables
-- =====================================================

-- 1) Catálogo de categorías
DO $$ BEGIN
  CREATE TYPE public.producto_categoria AS ENUM (
    'levaduras','nutrientes','clarificantes','estabilizantes','enzimas',
    'limpieza','laboratorio','aditivos','consumibles','otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lote_estado AS ENUM ('disponible','agotado','caducado','bloqueado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Ampliar tabla productos (sin eliminar columnas existentes)
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS categoria public.producto_categoria,
  ADD COLUMN IF NOT EXISTS fabricante text,
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS unidad text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS stock_minimo numeric(14,3),
  ADD COLUMN IF NOT EXISTS stock_critico numeric(14,3),
  ADD COLUMN IF NOT EXISTS ficha_tecnica_url text,
  ADD COLUMN IF NOT EXISTS ficha_seguridad_url text;

-- Permitir lote NULL en productos (el lote pasa a su propia tabla)
ALTER TABLE public.productos ALTER COLUMN lote DROP NOT NULL;

-- 3) Lotes de producto
CREATE TABLE IF NOT EXISTS public.producto_lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  numero_lote text NOT NULL,
  proveedor text,
  fecha_recepcion date,
  fecha_caducidad date,
  cantidad_inicial numeric(14,3) NOT NULL CHECK (cantidad_inicial >= 0),
  cantidad_disponible numeric(14,3) NOT NULL CHECK (cantidad_disponible >= 0),
  unidad text NOT NULL DEFAULT 'kg',
  coste_unitario numeric(12,4),
  ubicacion text,
  estado public.lote_estado NOT NULL DEFAULT 'disponible',
  motivo_bloqueo text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (bodega_id, producto_id, numero_lote)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_lotes TO authenticated;
GRANT ALL ON public.producto_lotes TO service_role;
ALTER TABLE public.producto_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lotes select bodega" ON public.producto_lotes
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "lotes insert bodega" ON public.producto_lotes
  FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "lotes update bodega" ON public.producto_lotes
  FOR UPDATE TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()))
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "lotes delete admin" ON public.producto_lotes
  FOR DELETE TO authenticated
  USING (public.is_bodega_admin(bodega_id));

CREATE INDEX IF NOT EXISTS idx_lotes_producto ON public.producto_lotes(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_bodega_estado ON public.producto_lotes(bodega_id, estado);
CREATE INDEX IF NOT EXISTS idx_lotes_caducidad ON public.producto_lotes(fecha_caducidad);

CREATE TRIGGER trg_lotes_updated_at BEFORE UPDATE ON public.producto_lotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Consumos de producto (trazabilidad completa)
CREATE TABLE IF NOT EXISTS public.consumos_producto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.producto_lotes(id) ON DELETE RESTRICT,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  unidad text NOT NULL,
  trabajador_id uuid,
  trabajo_id uuid REFERENCES public.trabajos(id) ON DELETE SET NULL,
  deposito_id text,
  elaboracion_id uuid REFERENCES public.elaboraciones(id) ON DELETE SET NULL,
  movimiento_id uuid REFERENCES public.movimientos(id) ON DELETE SET NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora time NOT NULL DEFAULT CURRENT_TIME,
  observaciones text,
  uso_caducado_autorizado boolean NOT NULL DEFAULT false,
  autorizado_por uuid,
  autorizado_en timestamptz,
  motivo_autorizacion text,
  anulado boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumos_producto TO authenticated;
GRANT ALL ON public.consumos_producto TO service_role;
ALTER TABLE public.consumos_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumos select bodega" ON public.consumos_producto
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "consumos insert bodega" ON public.consumos_producto
  FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "consumos update admin" ON public.consumos_producto
  FOR UPDATE TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));
CREATE POLICY "consumos no delete" ON public.consumos_producto
  FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_consumos_trabajo ON public.consumos_producto(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_consumos_lote ON public.consumos_producto(lote_id);
CREATE INDEX IF NOT EXISTS idx_consumos_producto ON public.consumos_producto(producto_id);
CREATE INDEX IF NOT EXISTS idx_consumos_elaboracion ON public.consumos_producto(elaboracion_id);
CREATE INDEX IF NOT EXISTS idx_consumos_bodega_fecha ON public.consumos_producto(bodega_id, fecha DESC);

-- 5) Trigger: validar y descontar stock en INSERT de consumo
CREATE OR REPLACE FUNCTION public.aplicar_consumo_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote public.producto_lotes%ROWTYPE;
BEGIN
  SELECT * INTO v_lote FROM public.producto_lotes WHERE id = NEW.lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote no encontrado'; END IF;
  IF v_lote.bodega_id <> NEW.bodega_id THEN
    RAISE EXCEPTION 'El lote no pertenece a esta bodega';
  END IF;
  IF v_lote.producto_id <> NEW.producto_id THEN
    RAISE EXCEPTION 'El lote no corresponde al producto indicado';
  END IF;
  IF v_lote.estado = 'bloqueado' THEN
    RAISE EXCEPTION 'El lote está bloqueado y no puede consumirse';
  END IF;
  IF v_lote.estado = 'caducado' AND NOT NEW.uso_caducado_autorizado THEN
    RAISE EXCEPTION 'El lote está caducado. Se requiere autorización del enólogo.';
  END IF;
  IF v_lote.fecha_caducidad IS NOT NULL AND v_lote.fecha_caducidad < CURRENT_DATE AND NOT NEW.uso_caducado_autorizado THEN
    RAISE EXCEPTION 'El lote está caducado. Se requiere autorización del enólogo.';
  END IF;
  IF NEW.cantidad > v_lote.cantidad_disponible THEN
    RAISE EXCEPTION 'Cantidad solicitada (%) supera el disponible del lote (%)', NEW.cantidad, v_lote.cantidad_disponible;
  END IF;

  UPDATE public.producto_lotes
     SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
         estado = CASE WHEN cantidad_disponible - NEW.cantidad <= 0 THEN 'agotado'::lote_estado ELSE estado END,
         updated_at = now()
   WHERE id = NEW.lote_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_aplicar_consumo ON public.consumos_producto;
CREATE TRIGGER trg_aplicar_consumo
  BEFORE INSERT ON public.consumos_producto
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_consumo_lote();

-- 6) Trigger: marcar caducado automáticamente al actualizar fecha
CREATE OR REPLACE FUNCTION public.actualizar_estado_lote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cantidad_disponible <= 0 AND NEW.estado <> 'bloqueado' THEN
    NEW.estado := 'agotado';
  ELSIF NEW.fecha_caducidad IS NOT NULL AND NEW.fecha_caducidad < CURRENT_DATE
        AND NEW.estado NOT IN ('bloqueado','agotado') THEN
    NEW.estado := 'caducado';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_estado_lote ON public.producto_lotes;
CREATE TRIGGER trg_estado_lote
  BEFORE INSERT OR UPDATE ON public.producto_lotes
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_estado_lote();

-- 7) Auditoría: productos, lotes, consumos
CREATE OR REPLACE FUNCTION public.audit_producto_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payload jsonb;
  v_bodega uuid;
  v_id text;
  v_accion text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_bodega := OLD.bodega_id; v_id := OLD.id::text;
    v_payload := jsonb_build_object('anterior', to_jsonb(OLD));
    v_accion := 'DELETE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_bodega := NEW.bodega_id; v_id := NEW.id::text;
    v_payload := jsonb_build_object('anterior', to_jsonb(OLD), 'nuevo', to_jsonb(NEW));
    v_accion := 'UPDATE';
  ELSE
    v_bodega := NEW.bodega_id; v_id := NEW.id::text;
    v_payload := jsonb_build_object('nuevo', to_jsonb(NEW));
    v_accion := 'INSERT';
  END IF;
  INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
  VALUES (v_bodega, v_user, v_accion, TG_TABLE_NAME, v_id, v_payload);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_productos ON public.productos;
CREATE TRIGGER trg_audit_productos
  AFTER INSERT OR UPDATE OR DELETE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

DROP TRIGGER IF EXISTS trg_audit_lotes ON public.producto_lotes;
CREATE TRIGGER trg_audit_lotes
  AFTER INSERT OR UPDATE OR DELETE ON public.producto_lotes
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

DROP TRIGGER IF EXISTS trg_audit_consumos ON public.consumos_producto;
CREATE TRIGGER trg_audit_consumos
  AFTER INSERT OR UPDATE ON public.consumos_producto
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

-- 8) Vista: stock por producto (suma de lotes disponibles)
CREATE OR REPLACE VIEW public.stock_por_producto
WITH (security_invoker = on) AS
SELECT
  p.id AS producto_id,
  p.bodega_id,
  p.nombre,
  p.categoria,
  p.unidad,
  p.stock_minimo,
  p.stock_critico,
  COALESCE(SUM(CASE WHEN l.estado = 'disponible' THEN l.cantidad_disponible ELSE 0 END), 0) AS stock_disponible,
  COUNT(l.id) FILTER (WHERE l.estado = 'disponible') AS lotes_activos,
  COUNT(l.id) FILTER (WHERE l.estado = 'caducado') AS lotes_caducados,
  MIN(l.fecha_caducidad) FILTER (WHERE l.estado = 'disponible') AS proxima_caducidad
FROM public.productos p
LEFT JOIN public.producto_lotes l ON l.producto_id = p.id
GROUP BY p.id;

-- 9) Función helper: marcar lotes caducados (puede ejecutarse periódicamente)
CREATE OR REPLACE FUNCTION public.marcar_lotes_caducados()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH upd AS (
    UPDATE public.producto_lotes
       SET estado = 'caducado', updated_at = now()
     WHERE fecha_caducidad IS NOT NULL
       AND fecha_caducidad < CURRENT_DATE
       AND estado = 'disponible'
    RETURNING 1
  ) SELECT COUNT(*)::int FROM upd;
$$;

-- 10) Preparación para fases futuras: columnas en consumos para contratos
ALTER TABLE public.consumos_producto
  ADD COLUMN IF NOT EXISTS contrato_compra_id uuid,
  ADD COLUMN IF NOT EXISTS contrato_venta_id uuid,
  ADD COLUMN IF NOT EXISTS incidencia_id uuid;
