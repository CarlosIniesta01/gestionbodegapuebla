
DO $$ BEGIN
  CREATE TYPE public.calendario_tipo AS ENUM (
    'carga','descarga','trabajo','limpieza','trasiego','mezcla','embotellado',
    'expedicion','mantenimiento','incidencia','recordatorio','auditoria','analisis'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendario_estado AS ENUM (
    'programado','en_proceso','completado','cancelado','retrasado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendario_prioridad AS ENUM ('baja','normal','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.calendario_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id UUID NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  tipo public.calendario_tipo NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  zona_id UUID,
  deposito_origen TEXT,
  deposito_destino TEXT,
  producto_id UUID,
  contrato_compra_id UUID,
  contrato_venta_id UUID,
  trabajo_id UUID,
  cliente_id UUID,
  proveedor_id UUID,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  estado public.calendario_estado NOT NULL DEFAULT 'programado',
  prioridad public.calendario_prioridad NOT NULL DEFAULT 'normal',
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  observaciones TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin > fecha_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_eventos TO authenticated;
GRANT ALL ON public.calendario_eventos TO service_role;

CREATE INDEX IF NOT EXISTS calendario_eventos_bodega_idx ON public.calendario_eventos(bodega_id);
CREATE INDEX IF NOT EXISTS calendario_eventos_rango_idx ON public.calendario_eventos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS calendario_eventos_tipo_idx ON public.calendario_eventos(tipo);
CREATE INDEX IF NOT EXISTS calendario_eventos_estado_idx ON public.calendario_eventos(estado);

CREATE TABLE IF NOT EXISTS public.calendario_evento_trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.calendario_eventos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bodega_id UUID NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (evento_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_evento_trabajadores TO authenticated;
GRANT ALL ON public.calendario_evento_trabajadores TO service_role;

CREATE INDEX IF NOT EXISTS cal_evt_trab_user_idx ON public.calendario_evento_trabajadores(user_id);
CREATE INDEX IF NOT EXISTS cal_evt_trab_evento_idx ON public.calendario_evento_trabajadores(evento_id);

CREATE OR REPLACE FUNCTION public._calendario_set_updated_at() RETURNS trigger AS $f$
BEGIN NEW.updated_at := now(); RETURN NEW; END $f$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_cal_evt_updated ON public.calendario_eventos;
CREATE TRIGGER trg_cal_evt_updated BEFORE UPDATE ON public.calendario_eventos
  FOR EACH ROW EXECUTE FUNCTION public._calendario_set_updated_at();

ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_evento_trabajadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cal_evt_select ON public.calendario_eventos;
CREATE POLICY cal_evt_select ON public.calendario_eventos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.bodega_id = calendario_eventos.bodega_id
        AND m.user_id = auth.uid() AND m.estado = 'activo'
    )
  );

DROP POLICY IF EXISTS cal_evt_modify ON public.calendario_eventos;
CREATE POLICY cal_evt_modify ON public.calendario_eventos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.bodega_id = calendario_eventos.bodega_id
        AND m.user_id = auth.uid() AND m.estado = 'activo'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.bodega_id = calendario_eventos.bodega_id
        AND m.user_id = auth.uid() AND m.estado = 'activo'
    )
  );

DROP POLICY IF EXISTS cal_evt_trab_select ON public.calendario_evento_trabajadores;
CREATE POLICY cal_evt_trab_select ON public.calendario_evento_trabajadores
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.bodega_id = calendario_evento_trabajadores.bodega_id
        AND m.user_id = auth.uid() AND m.estado = 'activo'
    )
  );

DROP POLICY IF EXISTS cal_evt_trab_modify ON public.calendario_evento_trabajadores;
CREATE POLICY cal_evt_trab_modify ON public.calendario_evento_trabajadores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.bodega_id = calendario_evento_trabajadores.bodega_id
        AND m.user_id = auth.uid() AND m.estado = 'activo'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.bodega_id = calendario_evento_trabajadores.bodega_id
        AND m.user_id = auth.uid() AND m.estado = 'activo'
    )
  );

CREATE OR REPLACE FUNCTION public._calendario_audit() RETURNS trigger AS $f$
DECLARE v_payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN v_payload := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE v_payload := to_jsonb(OLD);
  END IF;
  BEGIN
    INSERT INTO public.auditoria (tabla, accion, registro_id, user_id, bodega_id, payload)
    VALUES (TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id), auth.uid(),
            COALESCE(NEW.bodega_id, OLD.bodega_id), v_payload);
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END $f$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_calendario_eventos_audit ON public.calendario_eventos;
CREATE TRIGGER trg_calendario_eventos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.calendario_eventos
  FOR EACH ROW EXECUTE FUNCTION public._calendario_audit();

DROP TRIGGER IF EXISTS trg_calendario_trab_audit ON public.calendario_evento_trabajadores;
CREATE TRIGGER trg_calendario_trab_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.calendario_evento_trabajadores
  FOR EACH ROW EXECUTE FUNCTION public._calendario_audit();
