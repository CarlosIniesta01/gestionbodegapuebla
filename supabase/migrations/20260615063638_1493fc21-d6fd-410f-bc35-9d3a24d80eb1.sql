
CREATE TABLE public.preparaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  vinos jsonb NOT NULL DEFAULT '[]'::jsonb,
  productos jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preparaciones TO authenticated;
GRANT ALL ON public.preparaciones TO service_role;

ALTER TABLE public.preparaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miembros pueden ver preparaciones"
  ON public.preparaciones FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "miembros pueden crear preparaciones"
  ON public.preparaciones FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()) AND created_by = auth.uid());

CREATE POLICY "autor o admin pueden actualizar preparaciones"
  ON public.preparaciones FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_bodega_admin(bodega_id))
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "autor o admin pueden borrar preparaciones"
  ON public.preparaciones FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_bodega_admin(bodega_id));

CREATE TRIGGER trg_preparaciones_updated_at
  BEFORE UPDATE ON public.preparaciones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_preparaciones_bodega ON public.preparaciones(bodega_id, created_at DESC);
