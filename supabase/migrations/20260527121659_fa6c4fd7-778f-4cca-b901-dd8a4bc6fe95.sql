
-- Enums
CREATE TYPE public.trabajo_tipo AS ENUM ('trasiego','vendimia','producto','limpieza','embotellado','incidencia','observacion');
CREATE TYPE public.trabajo_estado AS ENUM ('pendiente','en_curso','completado','cancelado');
CREATE TYPE public.trabajo_prioridad AS ENUM ('baja','normal','alta','urgente');
CREATE TYPE public.mensaje_canal AS ENUM ('general','deposito','trabajo');

-- ============ TRABAJOS ============
CREATE TABLE public.trabajos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  tipo public.trabajo_tipo NOT NULL,
  estado public.trabajo_estado NOT NULL DEFAULT 'pendiente',
  prioridad public.trabajo_prioridad NOT NULL DEFAULT 'normal',
  titulo text NOT NULL,
  descripcion text,
  deposito_origen text,
  deposito_destino text,
  asignado_a uuid,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trabajos_bodega ON public.trabajos(bodega_id, estado, scheduled_at DESC NULLS LAST, created_at DESC);
CREATE INDEX idx_trabajos_asignado ON public.trabajos(asignado_a) WHERE asignado_a IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trabajos TO authenticated;
GRANT ALL ON public.trabajos TO service_role;
ALTER TABLE public.trabajos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trabajos read members" ON public.trabajos FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()));
CREATE POLICY "trabajos insert members" ON public.trabajos FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT current_user_bodegas()) AND created_by = auth.uid());
CREATE POLICY "trabajos update author or admin" ON public.trabajos FOR UPDATE TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()) AND (created_by = auth.uid() OR asignado_a = auth.uid() OR is_bodega_admin(bodega_id)));
CREATE POLICY "trabajos delete author or admin" ON public.trabajos FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_bodega_admin(bodega_id));

-- ============ TRABAJO EVENTOS ============
CREATE TABLE public.trabajo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajo_id uuid NOT NULL REFERENCES public.trabajos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  contenido text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eventos_trabajo ON public.trabajo_eventos(trabajo_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.trabajo_eventos TO authenticated;
GRANT ALL ON public.trabajo_eventos TO service_role;
ALTER TABLE public.trabajo_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos read members" ON public.trabajo_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trabajos t WHERE t.id = trabajo_id AND t.bodega_id IN (SELECT current_user_bodegas())));
CREATE POLICY "eventos insert members" ON public.trabajo_eventos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.trabajos t WHERE t.id = trabajo_id AND t.bodega_id IN (SELECT current_user_bodegas())));
CREATE POLICY "eventos delete author" ON public.trabajo_eventos FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ MENSAJES ============
CREATE TABLE public.mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  canal public.mensaje_canal NOT NULL DEFAULT 'general',
  canal_ref text,
  user_id uuid NOT NULL,
  contenido text NOT NULL CHECK (length(contenido) > 0 AND length(contenido) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensajes_canal ON public.mensajes(bodega_id, canal, canal_ref, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.mensajes TO authenticated;
GRANT ALL ON public.mensajes TO service_role;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensajes read members" ON public.mensajes FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()));
CREATE POLICY "mensajes insert members" ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND bodega_id IN (SELECT current_user_bodegas()));
CREATE POLICY "mensajes delete author or admin" ON public.mensajes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_bodega_admin(bodega_id));

-- Updated at trigger fn (reuse if exists)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_trabajos_touch BEFORE UPDATE ON public.trabajos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER TABLE public.trabajos REPLICA IDENTITY FULL;
ALTER TABLE public.trabajo_eventos REPLICA IDENTITY FULL;
ALTER TABLE public.mensajes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trabajos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trabajo_eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
