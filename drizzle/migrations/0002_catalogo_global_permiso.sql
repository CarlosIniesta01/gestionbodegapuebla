INSERT INTO public.permissions (key, label, categoria, descripcion) VALUES
 ('operaciones.catalogo.global','Gestionar catálogo maestro global','operaciones','Crear y modificar familias y operaciones globales (todos los centros)')
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'operaciones.catalogo.global' FROM public.roles r WHERE r.key IN ('admin','enologo')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS fam_update ON public.familias_operativas;
CREATE POLICY fam_update ON public.familias_operativas FOR UPDATE TO authenticated
USING ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.global'))
    OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id,'operaciones.catalogo.edit')))
WITH CHECK ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.global'))
    OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id,'operaciones.catalogo.edit')));
DROP POLICY IF EXISTS fam_insert ON public.familias_operativas;
CREATE POLICY fam_insert ON public.familias_operativas FOR INSERT TO authenticated
WITH CHECK ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.global'))
    OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id,'operaciones.catalogo.create')));

DROP POLICY IF EXISTS op_update ON public.operaciones_catalogo;
CREATE POLICY op_update ON public.operaciones_catalogo FOR UPDATE TO authenticated
USING ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.global'))
    OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id,'operaciones.catalogo.edit')))
WITH CHECK ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.global'))
    OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id,'operaciones.catalogo.edit')));
DROP POLICY IF EXISTS op_insert ON public.operaciones_catalogo;
CREATE POLICY op_insert ON public.operaciones_catalogo FOR INSERT TO authenticated
WITH CHECK ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.global'))
    OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id,'operaciones.catalogo.create')));