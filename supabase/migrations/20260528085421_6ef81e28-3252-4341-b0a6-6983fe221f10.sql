
-- =========== FAMILIAS ===========
CREATE TABLE public.familias_recetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, nombre)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.familias_recetas TO authenticated;
GRANT ALL ON public.familias_recetas TO service_role;
ALTER TABLE public.familias_recetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fam read members" ON public.familias_recetas FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()));
CREATE POLICY "fam write members" ON public.familias_recetas FOR ALL TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()))
  WITH CHECK (bodega_id IN (SELECT current_user_bodegas()));

-- =========== RECETAS ===========
CREATE TABLE public.recetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL,
  nombre text NOT NULL,
  familia_id uuid REFERENCES public.familias_recetas(id) ON DELETE SET NULL,
  tipo text,
  descripcion text,
  observaciones text,
  activa boolean NOT NULL DEFAULT true,
  favorita boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  parent_id uuid REFERENCES public.recetas(id) ON DELETE SET NULL,
  uso_count integer NOT NULL DEFAULT 0,
  ultimo_uso_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recetas_bodega ON public.recetas(bodega_id);
CREATE INDEX idx_recetas_familia ON public.recetas(familia_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recetas TO authenticated;
GRANT ALL ON public.recetas TO service_role;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recetas read members" ON public.recetas FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()));
CREATE POLICY "recetas insert members" ON public.recetas FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT current_user_bodegas()) AND created_by = auth.uid());
CREATE POLICY "recetas update members" ON public.recetas FOR UPDATE TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()))
  WITH CHECK (bodega_id IN (SELECT current_user_bodegas()));
CREATE POLICY "recetas delete author or admin" ON public.recetas FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_bodega_admin(bodega_id));

CREATE TRIGGER trg_recetas_touch BEFORE UPDATE ON public.recetas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== RECETA_DEPOSITOS ===========
CREATE TABLE public.receta_depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id uuid NOT NULL REFERENCES public.recetas(id) ON DELETE CASCADE,
  zona_id text,
  deposito_codigo text NOT NULL,
  litros numeric,
  variedad text,
  observaciones text,
  orden integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_rd_receta ON public.receta_depositos(receta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receta_depositos TO authenticated;
GRANT ALL ON public.receta_depositos TO service_role;
ALTER TABLE public.receta_depositos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rd read members" ON public.receta_depositos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())));
CREATE POLICY "rd write members" ON public.receta_depositos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())));

-- =========== RECETA_PRODUCTOS ===========
CREATE TABLE public.receta_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id uuid NOT NULL REFERENCES public.recetas(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  dosis numeric,
  unidad text NOT NULL DEFAULT 'g',
  lote text NOT NULL,
  observaciones text,
  orden integer NOT NULL DEFAULT 0,
  CONSTRAINT receta_productos_lote_check CHECK (length(btrim(lote)) > 0)
);
CREATE INDEX idx_rp_receta ON public.receta_productos(receta_id);
CREATE INDEX idx_rp_producto ON public.receta_productos(producto_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receta_productos TO authenticated;
GRANT ALL ON public.receta_productos TO service_role;
ALTER TABLE public.receta_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp read members" ON public.receta_productos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())));
CREATE POLICY "rp write members" ON public.receta_productos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())));

-- =========== RECETA_PASOS ===========
CREATE TABLE public.receta_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id uuid NOT NULL REFERENCES public.recetas(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  texto text NOT NULL
);
CREATE INDEX idx_rpa_receta ON public.receta_pasos(receta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receta_pasos TO authenticated;
GRANT ALL ON public.receta_pasos TO service_role;
ALTER TABLE public.receta_pasos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpa read members" ON public.receta_pasos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())));
CREATE POLICY "rpa write members" ON public.receta_pasos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recetas r WHERE r.id = receta_id AND r.bodega_id IN (SELECT current_user_bodegas())));

-- =========== PERMISOS ===========
INSERT INTO public.permissions (key, label, categoria, descripcion) VALUES
  ('recetas.read',  'Ver recetas',        'Recetas',  'Consultar la biblioteca de recetas'),
  ('recetas.write', 'Crear/editar recetas','Recetas', 'Crear, editar y duplicar recetas'),
  ('recetas.delete','Eliminar recetas',   'Recetas',  'Eliminar o desactivar recetas'),
  ('recetas.use',   'Usar recetas',       'Recetas',  'Aplicar recetas en trabajos y elaboraciones'),
  ('productos.write','Gestionar productos','Productos','Crear y editar productos del catálogo')
ON CONFLICT (key) DO NOTHING;
