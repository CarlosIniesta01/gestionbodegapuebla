
-- =========================================================
-- movimiento_lineas (append-only, soporta mezclas multi-depósito)
-- =========================================================
CREATE TABLE public.movimiento_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id uuid NOT NULL REFERENCES public.movimientos(id) ON DELETE CASCADE,
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('origen','destino')),
  deposito_id text NOT NULL,
  producto_id uuid REFERENCES public.productos_comerciales(id) ON DELETE SET NULL,
  litros numeric(12,2) NOT NULL CHECK (litros > 0),
  grado numeric(5,2) CHECK (grado IS NULL OR (grado >= 0 AND grado <= 25)),
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
);
CREATE INDEX idx_movimiento_lineas_mov ON public.movimiento_lineas(movimiento_id);
CREATE INDEX idx_movimiento_lineas_bod ON public.movimiento_lineas(bodega_id);

GRANT SELECT, INSERT ON public.movimiento_lineas TO authenticated;
GRANT ALL ON public.movimiento_lineas TO service_role;

ALTER TABLE public.movimiento_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineas_select_member" ON public.movimiento_lineas
FOR SELECT TO authenticated
USING (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "lineas_insert_member" ON public.movimiento_lineas
FOR INSERT TO authenticated
WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
-- Sin UPDATE/DELETE: append-only.

-- Auditar también las líneas
CREATE TRIGGER trg_audit_movimiento_lineas
AFTER INSERT ON public.movimiento_lineas
FOR EACH ROW EXECUTE FUNCTION public.audit_movimiento();

-- =========================================================
-- perfiles_auditoria (visibilidad configurable por la organización)
-- =========================================================
CREATE TABLE public.perfiles_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  campos_visibles jsonb NOT NULL DEFAULT '[]'::jsonb,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  es_predeterminado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
);
CREATE INDEX idx_perfiles_auditoria_bod ON public.perfiles_auditoria(bodega_id);
CREATE UNIQUE INDEX uniq_perfil_default_por_bodega
  ON public.perfiles_auditoria(bodega_id) WHERE es_predeterminado;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfiles_auditoria TO authenticated;
GRANT ALL ON public.perfiles_auditoria TO service_role;

ALTER TABLE public.perfiles_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles_select_member" ON public.perfiles_auditoria
FOR SELECT TO authenticated
USING (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "perfiles_admin_insert" ON public.perfiles_auditoria
FOR INSERT TO authenticated
WITH CHECK (public.is_bodega_admin(bodega_id));

CREATE POLICY "perfiles_admin_update" ON public.perfiles_auditoria
FOR UPDATE TO authenticated
USING (public.is_bodega_admin(bodega_id))
WITH CHECK (public.is_bodega_admin(bodega_id));

CREATE POLICY "perfiles_admin_delete" ON public.perfiles_auditoria
FOR DELETE TO authenticated
USING (public.is_bodega_admin(bodega_id));

CREATE TRIGGER trg_perfiles_auditoria_updated
BEFORE UPDATE ON public.perfiles_auditoria
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
