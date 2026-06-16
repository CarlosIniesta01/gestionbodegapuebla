
-- ============ PRODUCTOS COMERCIALES ============
CREATE TABLE public.productos_comerciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id UUID NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  campaña TEXT,
  tipo TEXT,
  color TEXT,
  grado_referencia NUMERIC(5,2),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos_comerciales TO authenticated;
GRANT ALL ON public.productos_comerciales TO service_role;
ALTER TABLE public.productos_comerciales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_select_member" ON public.productos_comerciales FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "pc_insert_member" ON public.productos_comerciales FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "pc_update_admin" ON public.productos_comerciales FOR UPDATE TO authenticated
  USING (public.is_bodega_admin(bodega_id))
  WITH CHECK (public.is_bodega_admin(bodega_id));
CREATE POLICY "pc_delete_admin" ON public.productos_comerciales FOR DELETE TO authenticated
  USING (public.is_bodega_admin(bodega_id));

CREATE TRIGGER trg_pc_updated_at BEFORE UPDATE ON public.productos_comerciales
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MOVIMIENTOS ============
CREATE TYPE public.movimiento_tipo AS ENUM
  ('entrada','salida','trasiego','mezcla','embotellado','correccion','ajuste');

CREATE TABLE public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id UUID NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  tipo public.movimiento_tipo NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora TIME NOT NULL DEFAULT CURRENT_TIME,
  deposito_origen_id TEXT,
  deposito_destino_id TEXT,
  producto_id UUID REFERENCES public.productos_comerciales(id) ON DELETE SET NULL,
  litros NUMERIC(12,2) NOT NULL,
  grado NUMERIC(5,2),
  alcohol_absoluto NUMERIC(12,4) GENERATED ALWAYS AS (litros * COALESCE(grado,0) / 100) STORED,
  observaciones TEXT,
  trabajo_id UUID REFERENCES public.trabajos(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_bodega_fecha ON public.movimientos (bodega_id, fecha DESC, hora DESC);
CREATE INDEX idx_mov_origen ON public.movimientos (bodega_id, deposito_origen_id);
CREATE INDEX idx_mov_destino ON public.movimientos (bodega_id, deposito_destino_id);
CREATE INDEX idx_mov_producto ON public.movimientos (bodega_id, producto_id);

GRANT SELECT, INSERT ON public.movimientos TO authenticated;
GRANT ALL ON public.movimientos TO service_role;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_select_member" ON public.movimientos FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "mov_insert_member" ON public.movimientos FOR INSERT TO authenticated
  WITH CHECK (
    bodega_id IN (SELECT public.current_user_bodegas())
    AND created_by = auth.uid()
  );
-- No UPDATE / DELETE policies => inmutable for app users.

-- ============ AUDITORIA ============
CREATE TABLE public.auditoria (
  id BIGSERIAL PRIMARY KEY,
  bodega_id UUID REFERENCES public.bodegas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  tabla TEXT NOT NULL,
  registro_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aud_bodega_fecha ON public.auditoria (bodega_id, created_at DESC);

GRANT SELECT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aud_select_member" ON public.auditoria FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));

-- Trigger auditor para movimientos
CREATE OR REPLACE FUNCTION public.audit_movimiento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
  VALUES (NEW.bodega_id, NEW.created_by, TG_OP, 'movimientos', NEW.id::text, to_jsonb(NEW));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_mov AFTER INSERT ON public.movimientos
  FOR EACH ROW EXECUTE FUNCTION public.audit_movimiento();

-- ============ VISTA EXISTENCIAS ============
-- Calcula litros actuales por depósito (sumando entradas/destinos y restando salidas/orígenes)
CREATE OR REPLACE VIEW public.existencias_actuales
WITH (security_invoker=on) AS
WITH flujo AS (
  -- Litros que SALEN del origen (negativo)
  SELECT bodega_id, deposito_origen_id AS deposito_id, producto_id,
         -litros AS litros, grado, fecha, hora
    FROM public.movimientos
   WHERE deposito_origen_id IS NOT NULL
     AND tipo IN ('salida','trasiego','mezcla','embotellado','correccion','ajuste')
  UNION ALL
  -- Litros que ENTRAN al destino (positivo)
  SELECT bodega_id, deposito_destino_id AS deposito_id, producto_id,
         litros, grado, fecha, hora
    FROM public.movimientos
   WHERE deposito_destino_id IS NOT NULL
     AND tipo IN ('entrada','trasiego','mezcla','correccion','ajuste')
)
SELECT
  bodega_id,
  deposito_id,
  producto_id,
  SUM(litros) AS litros,
  CASE WHEN SUM(litros) > 0
       THEN SUM(litros * COALESCE(grado,0)) / NULLIF(SUM(litros),0)
       ELSE 0 END AS grado_medio,
  SUM(litros * COALESCE(grado,0) / 100) AS alcohol_absoluto
FROM flujo
GROUP BY bodega_id, deposito_id, producto_id;

GRANT SELECT ON public.existencias_actuales TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.productos_comerciales;
