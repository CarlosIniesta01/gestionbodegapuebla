
-- =============================================================
-- FASE 1 · Rectificación de movimientos + trazabilidad trabajadores
-- =============================================================

-- ---------- 1. Movimientos: nuevos campos ----------
DO $$ BEGIN
  CREATE TYPE public.movimiento_estado AS ENUM ('activo','corregido','anulado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS estado_movimiento public.movimiento_estado NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS motivo_correccion TEXT,
  ADD COLUMN IF NOT EXISTS corregido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corregido_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anulado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS movimiento_original_id UUID REFERENCES public.movimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mov_estado ON public.movimientos(bodega_id, estado_movimiento);
CREATE INDEX IF NOT EXISTS idx_mov_original ON public.movimientos(movimiento_original_id);

-- ---------- 2. Permitir UPDATE solo a admin / responsable ----------
GRANT UPDATE ON public.movimientos TO authenticated;

-- Helper: ¿puede el usuario rectificar movimientos?
CREATE OR REPLACE FUNCTION public.can_rectify_movimientos(_bodega uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.memberships m
      JOIN public.roles r ON r.id = m.role_id
     WHERE m.user_id = auth.uid()
       AND m.bodega_id = _bodega
       AND m.estado = 'activo'
       AND r.key IN ('admin','responsable')
  );
$$;

DROP POLICY IF EXISTS "mov_update_admin" ON public.movimientos;
CREATE POLICY "mov_update_admin" ON public.movimientos
  FOR UPDATE TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));

-- ---------- 3. Auditoría con datos antes/después ----------
CREATE OR REPLACE FUNCTION public.audit_movimiento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_payload := jsonb_build_object('nuevo', to_jsonb(NEW));
    INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
    VALUES (NEW.bodega_id, COALESCE(NEW.created_by, v_user), 'INSERT', 'movimientos', NEW.id::text, v_payload);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_payload := jsonb_build_object(
      'anterior', to_jsonb(OLD),
      'nuevo', to_jsonb(NEW),
      'motivo', COALESCE(NEW.motivo_correccion, NEW.motivo_anulacion),
      'cambio_estado', CASE WHEN OLD.estado_movimiento <> NEW.estado_movimiento
                            THEN OLD.estado_movimiento::text || ' -> ' || NEW.estado_movimiento::text
                            ELSE NULL END
    );
    INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
    VALUES (NEW.bodega_id, COALESCE(v_user, NEW.updated_by), 'UPDATE', 'movimientos', NEW.id::text, v_payload);
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_mov ON public.movimientos;
CREATE TRIGGER trg_audit_mov AFTER INSERT OR UPDATE ON public.movimientos
  FOR EACH ROW EXECUTE FUNCTION public.audit_movimiento();

-- ---------- 4. Vista existencias excluye anulados/corregidos ----------
CREATE OR REPLACE VIEW public.existencias_actuales
WITH (security_invoker=on) AS
WITH flujo AS (
  SELECT bodega_id, deposito_origen_id AS deposito_id, producto_id,
         -litros AS litros, grado
    FROM public.movimientos
   WHERE deposito_origen_id IS NOT NULL
     AND estado_movimiento = 'activo'
     AND tipo IN ('salida','trasiego','mezcla','embotellado','correccion','ajuste')
  UNION ALL
  SELECT bodega_id, deposito_destino_id AS deposito_id, producto_id,
         litros, grado
    FROM public.movimientos
   WHERE deposito_destino_id IS NOT NULL
     AND estado_movimiento = 'activo'
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

-- =============================================================
-- 5. TRABAJO_TRABAJADORES · trazabilidad por participante
-- =============================================================
DO $$ BEGIN
  CREATE TYPE public.participacion_estado AS ENUM
    ('asignado','en_proceso','finalizado','ausente','rechazado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.trabajo_trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id UUID NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  trabajo_id UUID NOT NULL REFERENCES public.trabajos(id) ON DELETE CASCADE,
  trabajador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movimiento_id UUID REFERENCES public.movimientos(id) ON DELETE SET NULL,
  proceso_id UUID,
  rol_en_trabajo TEXT,
  hora_inicio TIMESTAMPTZ,
  hora_fin TIMESTAMPTZ,
  estado_participacion public.participacion_estado NOT NULL DEFAULT 'asignado',
  confirmado_por_trabajador BOOLEAN NOT NULL DEFAULT false,
  fecha_confirmacion TIMESTAMPTZ,
  observaciones TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tt_trabajo ON public.trabajo_trabajadores(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_tt_trabajador ON public.trabajo_trabajadores(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_tt_movimiento ON public.trabajo_trabajadores(movimiento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trabajo_trabajadores TO authenticated;
GRANT ALL ON public.trabajo_trabajadores TO service_role;
ALTER TABLE public.trabajo_trabajadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tt_select_member" ON public.trabajo_trabajadores
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));

-- Asignar/retirar: admin o responsable de la bodega
CREATE POLICY "tt_insert_admin" ON public.trabajo_trabajadores
  FOR INSERT TO authenticated
  WITH CHECK (
    bodega_id IN (SELECT public.current_user_bodegas())
    AND public.can_rectify_movimientos(bodega_id)
  );

CREATE POLICY "tt_delete_admin" ON public.trabajo_trabajadores
  FOR DELETE TO authenticated
  USING (public.can_rectify_movimientos(bodega_id));

-- Actualizar: admin/responsable, o el propio trabajador (para confirmar/finalizar su parte)
CREATE POLICY "tt_update_admin_or_self" ON public.trabajo_trabajadores
  FOR UPDATE TO authenticated
  USING (
    public.can_rectify_movimientos(bodega_id)
    OR trabajador_id = auth.uid()
  )
  WITH CHECK (
    public.can_rectify_movimientos(bodega_id)
    OR trabajador_id = auth.uid()
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_tt_touch ON public.trabajo_trabajadores;
CREATE TRIGGER trg_tt_touch BEFORE UPDATE ON public.trabajo_trabajadores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger de auditoría para trabajo_trabajadores
CREATE OR REPLACE FUNCTION public.audit_trabajo_trabajadores()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payload jsonb;
  v_accion text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion := 'TRABAJADOR_ASIGNADO';
    v_payload := jsonb_build_object('nuevo', to_jsonb(NEW));
    INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
    VALUES (NEW.bodega_id, COALESCE(NEW.created_by, v_user), v_accion, 'trabajo_trabajadores', NEW.id::text, v_payload);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_accion := CASE
      WHEN OLD.estado_participacion <> NEW.estado_participacion
        AND NEW.estado_participacion = 'finalizado' THEN 'TRABAJADOR_FINALIZADO'
      WHEN OLD.estado_participacion <> NEW.estado_participacion
        THEN 'TRABAJADOR_ESTADO_' || upper(NEW.estado_participacion::text)
      ELSE 'UPDATE'
    END;
    v_payload := jsonb_build_object('anterior', to_jsonb(OLD), 'nuevo', to_jsonb(NEW));
    INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
    VALUES (NEW.bodega_id, v_user, v_accion, 'trabajo_trabajadores', NEW.id::text, v_payload);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object('anterior', to_jsonb(OLD));
    INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
    VALUES (OLD.bodega_id, v_user, 'TRABAJADOR_RETIRADO', 'trabajo_trabajadores', OLD.id::text, v_payload);
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_tt ON public.trabajo_trabajadores;
CREATE TRIGGER trg_audit_tt
  AFTER INSERT OR UPDATE OR DELETE ON public.trabajo_trabajadores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trabajo_trabajadores();

ALTER PUBLICATION supabase_realtime ADD TABLE public.trabajo_trabajadores;
