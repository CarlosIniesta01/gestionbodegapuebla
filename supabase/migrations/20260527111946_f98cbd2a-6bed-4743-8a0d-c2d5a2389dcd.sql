
-- drop overly-permissive insert policies (creation goes through trigger as definer)
drop policy if exists "orgs insert authenticated" on public.organizations;
drop policy if exists "bodegas insert authenticated" on public.bodegas;

-- lock down SECURITY DEFINER helpers
revoke execute on function public.user_bodegas(uuid) from public, anon;
revoke execute on function public.has_permission(uuid, text) from public, anon;
revoke execute on function public.is_bodega_admin(uuid) from public, anon;
revoke execute on function public.current_user_bodegas() from public, anon;

grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.is_bodega_admin(uuid) to authenticated;
grant execute on function public.current_user_bodegas() to authenticated;
-- user_bodegas takes arbitrary uuid → keep server-only
