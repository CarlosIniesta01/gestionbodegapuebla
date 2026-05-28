
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  new_org_id uuid;
  new_bodega_id uuid;
  admin_role_id uuid;
  any_bodega_exists boolean;
begin
  -- Always create the profile so admins can find and approve the user.
  insert into public.profiles (user_id, email, nombre, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  -- Bootstrap only: if no bodega exists in the whole system, this user becomes
  -- the admin of a freshly-created bodega. Otherwise the user stays pending
  -- until an administrator approves them from the Admin panel.
  select exists(select 1 from public.bodegas) into any_bodega_exists;
  if any_bodega_exists then
    return new;
  end if;

  insert into public.organizations (nombre) values (
    coalesce(new.raw_user_meta_data->>'organization', 'Mi Organización')
  ) returning id into new_org_id;

  insert into public.bodegas (organization_id, nombre) values (
    new_org_id,
    coalesce(new.raw_user_meta_data->>'bodega', 'Mi Bodega')
  ) returning id into new_bodega_id;

  insert into public.roles (bodega_id, key, nombre, color, icono, descripcion, is_system, activo)
  select new_bodega_id, key, nombre, color, icono, descripcion, true, activo
    from public.roles where bodega_id is null;

  insert into public.role_permissions (role_id, permission_key)
  select nr.id, rp.permission_key
    from public.roles sr
    join public.role_permissions rp on rp.role_id = sr.id
    join public.roles nr on nr.bodega_id = new_bodega_id and nr.key = sr.key
   where sr.bodega_id is null;

  select id into admin_role_id from public.roles where bodega_id = new_bodega_id and key = 'admin';

  insert into public.memberships (user_id, bodega_id, role_id, estado)
  values (new.id, new_bodega_id, admin_role_id, 'activo');

  return new;
end;
$function$;
