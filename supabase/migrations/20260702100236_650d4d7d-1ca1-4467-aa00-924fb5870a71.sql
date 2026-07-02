-- Enum de estado de resultado
DO $$ BEGIN
  CREATE TYPE public.analitica_estado AS ENUM ('conforme','no_conforme','pendiente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.analiticas_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  lote_id uuid NOT NULL,
  producto_id uuid,
  deposito_id uuid,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  parametro text NOT NULL,
  valor numeric(12,4),
  valor_texto text,
  unidad text,
  resultado_estado public.analitica_estado NOT NULL DEFAULT 'pendiente',
  observaciones text,
  realizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analiticas_lote_lote ON public.analiticas_lote(lote_id);
CREATE INDEX IF NOT EXISTS idx_analiticas_lote_bodega ON public.analiticas_lote(bodega_id);
CREATE INDEX IF NOT EXISTS idx_analiticas_lote_producto ON public.analiticas_lote(producto_id);
CREATE INDEX IF NOT EXISTS idx_analiticas_lote_deposito ON public.analiticas_lote(deposito_id);
CREATE INDEX IF NOT EXISTS idx_analiticas_lote_fecha ON public.analiticas_lote(fecha);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analiticas_lote TO authenticated;
GRANT ALL ON public.analiticas_lote TO service_role;

ALTER TABLE public.analiticas_lote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analiticas_lote_select" ON public.analiticas_lote
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "analiticas_lote_insert" ON public.analiticas_lote
  FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "analiticas_lote_update" ON public.analiticas_lote
  FOR UPDATE TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()))
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "analiticas_lote_delete" ON public.analiticas_lote
  FOR DELETE TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE TRIGGER trg_analiticas_lote_updated_at
  BEFORE UPDATE ON public.analiticas_lote
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_analiticas_lote_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.analiticas_lote
  FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();
