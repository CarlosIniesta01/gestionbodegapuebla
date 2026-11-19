DROP POLICY IF EXISTS "permissions read" ON public.permissions;
CREATE POLICY "permissions read" ON public.permissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.estado = 'activo'));