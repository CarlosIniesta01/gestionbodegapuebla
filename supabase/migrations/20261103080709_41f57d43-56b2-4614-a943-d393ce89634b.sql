ALTER TABLE public.productos_comerciales ADD COLUMN IF NOT EXISTS origen_creacion text;
ALTER TABLE public.movimientos ADD COLUMN IF NOT EXISTS import_batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_movimientos_import_batch ON public.movimientos(import_batch_id);

CREATE TABLE public.importaciones_existencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id),
  user_id uuid NOT NULL,
  archivo text,
  filas_total integer NOT NULL DEFAULT 0,
  filas_rechazadas integer NOT NULL DEFAULT 0,
  productos_creados integer NOT NULL DEFAULT 0,
  depositos_modificados integer NOT NULL DEFAULT 0,
  depositos_vaciados integer NOT NULL DEFAULT 0,
  sin_cambios integer NOT NULL DEFAULT 0,
  movimientos_generados integer NOT NULL DEFAULT 0,
  litros_entrada numeric NOT NULL DEFAULT 0,
  litros_salida numeric NOT NULL DEFAULT 0,
  productos_nuevos jsonb NOT NULL DEFAULT '[]'::jsonb,
  detalle jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.importaciones_existencias TO authenticated;
GRANT ALL ON public.importaciones_existencias TO service_role;
ALTER TABLE public.importaciones_existencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Miembros ven importaciones" ON public.importaciones_existencias FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "Autorizados registran importaciones" ON public.importaciones_existencias FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_rectify_movimientos(bodega_id));