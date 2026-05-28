-- 1) Fix broken RLS policy on organizations (was self-referential b.organization_id = b.id)
DROP POLICY IF EXISTS "orgs read" ON public.organizations;
CREATE POLICY "orgs read"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.bodegas b
     WHERE b.organization_id = organizations.id
       AND b.id IN (SELECT public.current_user_bodegas())
  )
);

-- 2) Restrict trabajo_asignados writes to bodega admin or trabajo author/assignee
DROP POLICY IF EXISTS "ta write members" ON public.trabajo_asignados;

CREATE POLICY "ta insert admin or author"
ON public.trabajo_asignados
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM public.trabajos t
     WHERE t.id = trabajo_asignados.trabajo_id
       AND (
         public.is_bodega_admin(t.bodega_id)
         OR t.created_by = auth.uid()
         OR t.asignado_a = auth.uid()
       )
  )
);

CREATE POLICY "ta update admin or author"
ON public.trabajo_asignados
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.trabajos t
     WHERE t.id = trabajo_asignados.trabajo_id
       AND (
         public.is_bodega_admin(t.bodega_id)
         OR t.created_by = auth.uid()
         OR t.asignado_a = auth.uid()
       )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM public.trabajos t
     WHERE t.id = trabajo_asignados.trabajo_id
       AND (
         public.is_bodega_admin(t.bodega_id)
         OR t.created_by = auth.uid()
         OR t.asignado_a = auth.uid()
       )
  )
);

CREATE POLICY "ta delete admin or author"
ON public.trabajo_asignados
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.trabajos t
     WHERE t.id = trabajo_asignados.trabajo_id
       AND (
         public.is_bodega_admin(t.bodega_id)
         OR t.created_by = auth.uid()
         OR t.asignado_a = auth.uid()
       )
  )
);

-- 3) Tighten EXECUTE on SECURITY DEFINER helpers: revoke from PUBLIC/anon,
--    keep authenticated/service_role since RLS policies invoke them.
REVOKE EXECUTE ON FUNCTION public.user_bodegas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_bodegas(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.current_user_bodegas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_bodegas() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_bodega_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bodega_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;