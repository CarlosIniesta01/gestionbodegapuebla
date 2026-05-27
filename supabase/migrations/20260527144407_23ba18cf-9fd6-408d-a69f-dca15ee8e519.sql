
-- ============ Catálogo de productos ============
CREATE TYPE public.producto_tipo AS ENUM ('enologico','limpieza','otro');

CREATE TABLE public.productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL,
  nombre text NOT NULL CHECK (length(trim(nombre)) > 0),
  tipo public.producto_tipo NOT NULL DEFAULT 'enologico',
  lote text NOT NULL CHECK (length(trim(lote)) > 0),
  proveedor text,
  fecha_caducidad date,
  activo boolean NOT NULL DEFAULT true,
  observaciones text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX productos_bodega_idx ON public.productos(bodega_id);
CREATE TRIGGER productos_touch BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos TO authenticated;
GRANT ALL ON public.productos TO service_role;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos read members" ON public.productos
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "productos insert admin" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_bodega_admin(bodega_id) AND created_by = auth.uid());
CREATE POLICY "productos update admin" ON public.productos
  FOR UPDATE TO authenticated
  USING (public.is_bodega_admin(bodega_id));
CREATE POLICY "productos delete admin" ON public.productos
  FOR DELETE TO authenticated
  USING (public.is_bodega_admin(bodega_id));

-- ============ Elaboraciones ============
CREATE TABLE public.elaboraciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL,
  trabajo_id uuid NOT NULL REFERENCES public.trabajos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  lote_embotellado text,
  observaciones text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX elaboraciones_bodega_idx ON public.elaboraciones(bodega_id);
CREATE INDEX elaboraciones_trabajo_idx ON public.elaboraciones(trabajo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elaboraciones TO authenticated;
GRANT ALL ON public.elaboraciones TO service_role;
ALTER TABLE public.elaboraciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elaboraciones read members" ON public.elaboraciones
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "elaboraciones insert members" ON public.elaboraciones
  FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()) AND created_by = auth.uid());
CREATE POLICY "elaboraciones delete author or admin" ON public.elaboraciones
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_bodega_admin(bodega_id));

CREATE TABLE public.elaboracion_depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elaboracion_id uuid NOT NULL REFERENCES public.elaboraciones(id) ON DELETE CASCADE,
  deposito_codigo text NOT NULL,
  zona text,
  litros numeric NOT NULL CHECK (litros >= 0),
  variedad text
);
CREATE INDEX elab_dep_elab_idx ON public.elaboracion_depositos(elaboracion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elaboracion_depositos TO authenticated;
GRANT ALL ON public.elaboracion_depositos TO service_role;
ALTER TABLE public.elaboracion_depositos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elab_dep read members" ON public.elaboracion_depositos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.elaboraciones e WHERE e.id = elaboracion_id AND e.bodega_id IN (SELECT public.current_user_bodegas())));
CREATE POLICY "elab_dep write members" ON public.elaboracion_depositos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.elaboraciones e WHERE e.id = elaboracion_id AND e.bodega_id IN (SELECT public.current_user_bodegas())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.elaboraciones e WHERE e.id = elaboracion_id AND e.bodega_id IN (SELECT public.current_user_bodegas())));

CREATE TABLE public.elaboracion_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elaboracion_id uuid NOT NULL REFERENCES public.elaboraciones(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id),
  lote text NOT NULL CHECK (length(trim(lote)) > 0),
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  unidad text NOT NULL DEFAULT 'g',
  observaciones text
);
CREATE INDEX elab_prod_elab_idx ON public.elaboracion_productos(elaboracion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elaboracion_productos TO authenticated;
GRANT ALL ON public.elaboracion_productos TO service_role;
ALTER TABLE public.elaboracion_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elab_prod read members" ON public.elaboracion_productos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.elaboraciones e WHERE e.id = elaboracion_id AND e.bodega_id IN (SELECT public.current_user_bodegas())));
CREATE POLICY "elab_prod write members" ON public.elaboracion_productos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.elaboraciones e WHERE e.id = elaboracion_id AND e.bodega_id IN (SELECT public.current_user_bodegas())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.elaboraciones e WHERE e.id = elaboracion_id AND e.bodega_id IN (SELECT public.current_user_bodegas())));

-- ============ Asignaciones múltiples a trabajos ============
CREATE TABLE public.trabajo_asignados (
  trabajo_id uuid NOT NULL REFERENCES public.trabajos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rol text NOT NULL DEFAULT 'operario',
  PRIMARY KEY (trabajo_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trabajo_asignados TO authenticated;
GRANT ALL ON public.trabajo_asignados TO service_role;
ALTER TABLE public.trabajo_asignados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta read members" ON public.trabajo_asignados
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trabajos t WHERE t.id = trabajo_id AND t.bodega_id IN (SELECT public.current_user_bodegas())));
CREATE POLICY "ta write members" ON public.trabajo_asignados
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trabajos t WHERE t.id = trabajo_id AND t.bodega_id IN (SELECT public.current_user_bodegas())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trabajos t WHERE t.id = trabajo_id AND t.bodega_id IN (SELECT public.current_user_bodegas())));

-- ============ Permisos en el catálogo ============
INSERT INTO public.permissions (key, label, categoria, descripcion) VALUES
  ('productos.manage', 'Gestionar productos', 'Productos', 'Crear, editar y desactivar productos del catálogo'),
  ('productos.use', 'Usar productos', 'Productos', 'Seleccionar productos al registrar trabajos'),
  ('embotellado.create', 'Registrar embotellado', 'Trabajos', 'Crear trabajos de embotellado y elaboraciones')
ON CONFLICT (key) DO NOTHING;

-- Otorgar a TODOS los roles admin existentes
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES ('productos.manage'),('productos.use'),('embotellado.create')) AS p(key)
WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.productos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.elaboraciones;
