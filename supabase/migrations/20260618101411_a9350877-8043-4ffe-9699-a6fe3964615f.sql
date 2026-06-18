
-- ============ ENUM estado contrato ============
DO $$ BEGIN
  CREATE TYPE public.contrato_estado AS ENUM ('pendiente','parcial','completado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ CLIENTES ============
CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  cif_nif text,
  direccion text,
  telefono text,
  email text,
  observaciones text,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_bodega ON public.clientes(bodega_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "clientes_write" ON public.clientes FOR ALL TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));

CREATE TRIGGER trg_clientes_touch BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_clientes_audit AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

-- ============ PROVEEDORES ============
CREATE TABLE IF NOT EXISTS public.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  cif_nif text,
  direccion text,
  telefono text,
  email text,
  observaciones text,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proveedores_bodega ON public.proveedores(bodega_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
GRANT ALL ON public.proveedores TO service_role;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select" ON public.proveedores FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "proveedores_write" ON public.proveedores FOR ALL TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));

CREATE TRIGGER trg_proveedores_touch BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_proveedores_audit AFTER INSERT OR UPDATE OR DELETE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

-- ============ CONTRATOS DE COMPRA ============
CREATE TABLE IF NOT EXISTS public.contratos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  numero_contrato text NOT NULL,
  proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  producto_id uuid REFERENCES public.productos_comerciales(id) ON DELETE SET NULL,
  campana text,
  litros_contratados numeric(12,2) NOT NULL CHECK (litros_contratados > 0),
  litros_retirados numeric(12,2) NOT NULL DEFAULT 0,
  litros_pendientes numeric(12,2) GENERATED ALWAYS AS (litros_contratados - litros_retirados) STORED,
  precio numeric(12,4),
  fecha_contrato date NOT NULL DEFAULT CURRENT_DATE,
  fecha_limite date,
  observaciones text,
  estado public.contrato_estado NOT NULL DEFAULT 'pendiente',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, numero_contrato)
);
CREATE INDEX IF NOT EXISTS idx_cc_bodega ON public.contratos_compra(bodega_id);
CREATE INDEX IF NOT EXISTS idx_cc_proveedor ON public.contratos_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_cc_producto ON public.contratos_compra(producto_id);
CREATE INDEX IF NOT EXISTS idx_cc_estado ON public.contratos_compra(bodega_id, estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_compra TO authenticated;
GRANT ALL ON public.contratos_compra TO service_role;
ALTER TABLE public.contratos_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_select" ON public.contratos_compra FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "cc_write" ON public.contratos_compra FOR ALL TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));

CREATE TRIGGER trg_cc_touch BEFORE UPDATE ON public.contratos_compra
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cc_audit AFTER INSERT OR UPDATE OR DELETE ON public.contratos_compra
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

-- ============ CONTRATOS DE VENTA ============
CREATE TABLE IF NOT EXISTS public.contratos_venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  numero_contrato text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  producto_id uuid REFERENCES public.productos_comerciales(id) ON DELETE SET NULL,
  campana text,
  litros_contratados numeric(12,2) NOT NULL CHECK (litros_contratados > 0),
  litros_servidos numeric(12,2) NOT NULL DEFAULT 0,
  litros_pendientes numeric(12,2) GENERATED ALWAYS AS (litros_contratados - litros_servidos) STORED,
  precio numeric(12,4),
  fecha_contrato date NOT NULL DEFAULT CURRENT_DATE,
  fecha_limite date,
  observaciones text,
  estado public.contrato_estado NOT NULL DEFAULT 'pendiente',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, numero_contrato)
);
CREATE INDEX IF NOT EXISTS idx_cv_bodega ON public.contratos_venta(bodega_id);
CREATE INDEX IF NOT EXISTS idx_cv_cliente ON public.contratos_venta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cv_producto ON public.contratos_venta(producto_id);
CREATE INDEX IF NOT EXISTS idx_cv_estado ON public.contratos_venta(bodega_id, estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_venta TO authenticated;
GRANT ALL ON public.contratos_venta TO service_role;
ALTER TABLE public.contratos_venta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_select" ON public.contratos_venta FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "cv_write" ON public.contratos_venta FOR ALL TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));

CREATE TRIGGER trg_cv_touch BEFORE UPDATE ON public.contratos_venta
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cv_audit AFTER INSERT OR UPDATE OR DELETE ON public.contratos_venta
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

-- ============ FKs en movimientos hacia contratos ============
DO $$ BEGIN
  ALTER TABLE public.movimientos
    ADD CONSTRAINT movimientos_contrato_compra_fkey
    FOREIGN KEY (contrato_compra_id) REFERENCES public.contratos_compra(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimientos
    ADD CONSTRAINT movimientos_contrato_venta_fkey
    FOREIGN KEY (contrato_venta_id) REFERENCES public.contratos_venta(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Funciones de recálculo ============
CREATE OR REPLACE FUNCTION public.recalcular_contrato_compra(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sum numeric(12,2);
        v_total numeric(12,2);
        v_estado contrato_estado;
BEGIN
  IF _id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(litros),0) INTO v_sum
    FROM public.movimientos
   WHERE contrato_compra_id = _id
     AND estado_movimiento = 'activo'
     AND tipo = 'entrada';
  SELECT litros_contratados, estado INTO v_total, v_estado
    FROM public.contratos_compra WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.contratos_compra
     SET litros_retirados = v_sum,
         estado = CASE
           WHEN estado = 'cancelado' THEN 'cancelado'
           WHEN v_sum <= 0 THEN 'pendiente'
           WHEN v_sum >= v_total THEN 'completado'
           ELSE 'parcial'
         END,
         updated_at = now()
   WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.recalcular_contrato_venta(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sum numeric(12,2);
        v_total numeric(12,2);
BEGIN
  IF _id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(litros),0) INTO v_sum
    FROM public.movimientos
   WHERE contrato_venta_id = _id
     AND estado_movimiento = 'activo'
     AND tipo = 'salida';
  SELECT litros_contratados INTO v_total
    FROM public.contratos_venta WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.contratos_venta
     SET litros_servidos = v_sum,
         estado = CASE
           WHEN estado = 'cancelado' THEN 'cancelado'
           WHEN v_sum <= 0 THEN 'pendiente'
           WHEN v_sum >= v_total THEN 'completado'
           ELSE 'parcial'
         END,
         updated_at = now()
   WHERE id = _id;
END $$;

-- ============ Validación + trigger sobre movimientos ============
CREATE OR REPLACE FUNCTION public.validar_contrato_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pend numeric(12,2);
        v_estado contrato_estado;
        v_litros_otros numeric(12,2);
        v_total numeric(12,2);
BEGIN
  -- Validar contrato_compra solo en entradas activas
  IF NEW.contrato_compra_id IS NOT NULL
     AND NEW.estado_movimiento = 'activo'
     AND NEW.tipo = 'entrada' THEN
    SELECT litros_contratados, estado INTO v_total, v_estado
      FROM public.contratos_compra WHERE id = NEW.contrato_compra_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrato de compra no encontrado'; END IF;
    IF v_estado = 'cancelado' THEN RAISE EXCEPTION 'Contrato de compra cancelado'; END IF;
    SELECT COALESCE(SUM(litros),0) INTO v_litros_otros
      FROM public.movimientos
     WHERE contrato_compra_id = NEW.contrato_compra_id
       AND estado_movimiento = 'activo'
       AND tipo = 'entrada'
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF v_litros_otros + NEW.litros > v_total THEN
      RAISE EXCEPTION 'La entrada (% L) supera los litros pendientes del contrato de compra (% L)',
        NEW.litros, v_total - v_litros_otros;
    END IF;
  END IF;

  IF NEW.contrato_venta_id IS NOT NULL
     AND NEW.estado_movimiento = 'activo'
     AND NEW.tipo = 'salida' THEN
    SELECT litros_contratados, estado INTO v_total, v_estado
      FROM public.contratos_venta WHERE id = NEW.contrato_venta_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrato de venta no encontrado'; END IF;
    IF v_estado = 'cancelado' THEN RAISE EXCEPTION 'Contrato de venta cancelado'; END IF;
    SELECT COALESCE(SUM(litros),0) INTO v_litros_otros
      FROM public.movimientos
     WHERE contrato_venta_id = NEW.contrato_venta_id
       AND estado_movimiento = 'activo'
       AND tipo = 'salida'
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF v_litros_otros + NEW.litros > v_total THEN
      RAISE EXCEPTION 'La salida (% L) supera los litros pendientes del contrato de venta (% L)',
        NEW.litros, v_total - v_litros_otros;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mov_validar_contrato ON public.movimientos;
CREATE TRIGGER trg_mov_validar_contrato
  BEFORE INSERT OR UPDATE ON public.movimientos
  FOR EACH ROW EXECUTE FUNCTION public.validar_contrato_movimiento();

CREATE OR REPLACE FUNCTION public.recalcular_contratos_mov()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM public.recalcular_contrato_compra(NEW.contrato_compra_id);
    PERFORM public.recalcular_contrato_venta(NEW.contrato_venta_id);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.contrato_compra_id IS DISTINCT FROM NEW.contrato_compra_id THEN
        PERFORM public.recalcular_contrato_compra(OLD.contrato_compra_id);
      END IF;
      IF OLD.contrato_venta_id IS DISTINCT FROM NEW.contrato_venta_id THEN
        PERFORM public.recalcular_contrato_venta(OLD.contrato_venta_id);
      END IF;
    ELSE
      PERFORM public.recalcular_contrato_compra(OLD.contrato_compra_id);
      PERFORM public.recalcular_contrato_venta(OLD.contrato_venta_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_mov_recalcular_contratos ON public.movimientos;
CREATE TRIGGER trg_mov_recalcular_contratos
  AFTER INSERT OR UPDATE OR DELETE ON public.movimientos
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_contratos_mov();

-- ============ Vistas para Posición Comercial ============
CREATE OR REPLACE VIEW public.v_contratos_compra_pendientes
WITH (security_invoker=on) AS
SELECT bodega_id, producto_id, campana,
       SUM(litros_pendientes) AS litros_pendientes,
       COUNT(*) AS n_contratos
  FROM public.contratos_compra
 WHERE estado IN ('pendiente','parcial')
 GROUP BY bodega_id, producto_id, campana;

CREATE OR REPLACE VIEW public.v_contratos_venta_pendientes
WITH (security_invoker=on) AS
SELECT bodega_id, producto_id, campana,
       SUM(litros_pendientes) AS litros_pendientes,
       COUNT(*) AS n_contratos
  FROM public.contratos_venta
 WHERE estado IN ('pendiente','parcial')
 GROUP BY bodega_id, producto_id, campana;

CREATE OR REPLACE VIEW public.v_posicion_comercial
WITH (security_invoker=on) AS
WITH ex AS (
  SELECT bodega_id, producto_id, SUM(litros) AS litros_existencia
    FROM public.existencias_actuales
   GROUP BY bodega_id, producto_id
), cp AS (
  SELECT bodega_id, producto_id, SUM(litros_pendientes) AS compras_pendientes
    FROM public.contratos_compra
   WHERE estado IN ('pendiente','parcial')
   GROUP BY bodega_id, producto_id
), vp AS (
  SELECT bodega_id, producto_id, SUM(litros_pendientes) AS ventas_pendientes
    FROM public.contratos_venta
   WHERE estado IN ('pendiente','parcial')
   GROUP BY bodega_id, producto_id
)
SELECT
  COALESCE(ex.bodega_id, cp.bodega_id, vp.bodega_id) AS bodega_id,
  COALESCE(ex.producto_id, cp.producto_id, vp.producto_id) AS producto_id,
  COALESCE(ex.litros_existencia, 0) AS litros_existencia,
  COALESCE(cp.compras_pendientes, 0) AS compras_pendientes,
  COALESCE(vp.ventas_pendientes, 0) AS ventas_pendientes,
  COALESCE(ex.litros_existencia, 0) + COALESCE(cp.compras_pendientes, 0) - COALESCE(vp.ventas_pendientes, 0) AS disponible_comercial
FROM ex
FULL OUTER JOIN cp ON cp.bodega_id = ex.bodega_id AND cp.producto_id = ex.producto_id
FULL OUTER JOIN vp ON vp.bodega_id = COALESCE(ex.bodega_id, cp.bodega_id) AND vp.producto_id = COALESCE(ex.producto_id, cp.producto_id);

GRANT SELECT ON public.v_contratos_compra_pendientes TO authenticated;
GRANT SELECT ON public.v_contratos_venta_pendientes TO authenticated;
GRANT SELECT ON public.v_posicion_comercial TO authenticated;
