
-- =========================================================
--  ENUMS
-- =========================================================
create type public.membership_estado as enum ('activo','inactivo','suspendido');

-- =========================================================
--  CORE TABLES
-- =========================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

create table public.bodegas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  ubicacion text,
  created_at timestamptz not null default now()
);
create index on public.bodegas(organization_id);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  telefono text,
  avatar_url text,
  ultima_conexion timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  categoria text not null,
  label text not null,
  descripcion text
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid references public.bodegas(id) on delete cascade,  -- null = sistema
  key text not null,
  nombre text not null,
  color text not null default '#6b7280',
  icono text not null default 'Shield',
  descripcion text,
  is_system boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (bodega_id, key)
);
create index on public.roles(bodega_id);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bodega_id uuid not null references public.bodegas(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  estado public.membership_estado not null default 'activo',
  created_at timestamptz not null default now(),
  unique (user_id, bodega_id)
);
create index on public.memberships(bodega_id);
create index on public.memberships(user_id);

create table public.membership_zonas (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  zona_id text not null,
  primary key (membership_id, zona_id)
);

-- =========================================================
--  GRANTS
-- =========================================================
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;

grant select, insert, update, delete on public.bodegas to authenticated;
grant all on public.bodegas to service_role;

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.permissions to authenticated;
grant all on public.permissions to service_role;

grant select, insert, update, delete on public.roles to authenticated;
grant all on public.roles to service_role;

grant select, insert, update, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;

grant select, insert, update, delete on public.membership_zonas to authenticated;
grant all on public.membership_zonas to service_role;

-- =========================================================
--  SECURITY DEFINER HELPERS
-- =========================================================
create or replace function public.user_bodegas(_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bodega_id
    from public.memberships
   where user_id = _user
     and estado = 'activo';
$$;

create or replace function public.has_permission(_bodega uuid, _perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.memberships m
      join public.role_permissions rp on rp.role_id = m.role_id
     where m.user_id = auth.uid()
       and m.bodega_id = _bodega
       and m.estado = 'activo'
       and rp.permission_key = _perm
  );
$$;

create or replace function public.is_bodega_admin(_bodega uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id = auth.uid()
       and m.bodega_id = _bodega
       and m.estado = 'activo'
       and r.key = 'admin'
  );
$$;

create or replace function public.current_user_bodegas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bodega_id
    from public.memberships
   where user_id = auth.uid()
     and estado = 'activo';
$$;

-- =========================================================
--  RLS
-- =========================================================
alter table public.organizations enable row level security;
alter table public.bodegas enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_zonas enable row level security;

-- profiles: cada usuario gestiona el suyo; miembros de la misma bodega pueden leer
create policy "profiles self read" on public.profiles for select to authenticated
  using (user_id = auth.uid()
         or exists (
           select 1 from public.memberships m1
            join public.memberships m2 on m2.bodega_id = m1.bodega_id
           where m1.user_id = auth.uid() and m1.estado='activo'
             and m2.user_id = public.profiles.user_id
         ));
create policy "profiles self upsert" on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy "profiles self update" on public.profiles for update to authenticated
  using (user_id = auth.uid());

-- permissions: lectura para autenticados
create policy "permissions read" on public.permissions for select to authenticated using (true);

-- organizations: solo accesibles si el usuario tiene una bodega de esa org
create policy "orgs read" on public.organizations for select to authenticated
  using (exists (
    select 1 from public.bodegas b
     where b.organization_id = id
       and b.id in (select public.current_user_bodegas())
  ));
create policy "orgs insert authenticated" on public.organizations for insert to authenticated with check (true);

-- bodegas
create policy "bodegas read members" on public.bodegas for select to authenticated
  using (id in (select public.current_user_bodegas()));
create policy "bodegas insert authenticated" on public.bodegas for insert to authenticated with check (true);
create policy "bodegas update admin" on public.bodegas for update to authenticated
  using (public.is_bodega_admin(id));

-- roles
create policy "roles read members" on public.roles for select to authenticated
  using (bodega_id is null or bodega_id in (select public.current_user_bodegas()));
create policy "roles write admin" on public.roles for all to authenticated
  using (bodega_id is not null and public.is_bodega_admin(bodega_id))
  with check (bodega_id is not null and public.is_bodega_admin(bodega_id));

-- role_permissions
create policy "role_perms read members" on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.roles r where r.id = role_id
      and (r.bodega_id is null or r.bodega_id in (select public.current_user_bodegas()))
  ));
create policy "role_perms write admin" on public.role_permissions for all to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and r.bodega_id is not null and public.is_bodega_admin(r.bodega_id)))
  with check (exists (select 1 from public.roles r where r.id = role_id and r.bodega_id is not null and public.is_bodega_admin(r.bodega_id)));

-- memberships
create policy "memberships read members" on public.memberships for select to authenticated
  using (bodega_id in (select public.current_user_bodegas()));
create policy "memberships insert admin" on public.memberships for insert to authenticated
  with check (public.is_bodega_admin(bodega_id));
create policy "memberships update admin" on public.memberships for update to authenticated
  using (public.is_bodega_admin(bodega_id));
create policy "memberships delete admin" on public.memberships for delete to authenticated
  using (public.is_bodega_admin(bodega_id));

-- membership_zonas
create policy "mz read members" on public.membership_zonas for select to authenticated
  using (exists (select 1 from public.memberships m where m.id = membership_id and m.bodega_id in (select public.current_user_bodegas())));
create policy "mz write admin" on public.membership_zonas for all to authenticated
  using (exists (select 1 from public.memberships m where m.id = membership_id and public.is_bodega_admin(m.bodega_id)))
  with check (exists (select 1 from public.memberships m where m.id = membership_id and public.is_bodega_admin(m.bodega_id)));

-- =========================================================
--  PROFILE AUTO-CREATION + FIRST BODEGA BOOTSTRAP
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  new_bodega_id uuid;
  admin_role_id uuid;
begin
  -- profile
  insert into public.profiles (user_id, email, nombre, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- crear org+bodega y asignar admin
  insert into public.organizations (nombre) values (
    coalesce(new.raw_user_meta_data->>'organization', 'Mi Organización')
  ) returning id into new_org_id;

  insert into public.bodegas (organization_id, nombre) values (
    new_org_id,
    coalesce(new.raw_user_meta_data->>'bodega', 'Mi Bodega')
  ) returning id into new_bodega_id;

  -- clonar roles del sistema en la nueva bodega
  insert into public.roles (bodega_id, key, nombre, color, icono, descripcion, is_system, activo)
  select new_bodega_id, key, nombre, color, icono, descripcion, true, activo
    from public.roles where bodega_id is null;

  -- copiar role_permissions desde plantillas de sistema
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
--  SEED: permisos
-- =========================================================
insert into public.permissions (key, categoria, label) values
  ('nav.inicio','Navegación','Ver Inicio'),
  ('nav.mapa','Navegación','Ver Mapa'),
  ('nav.trabajos','Navegación','Ver Trabajos'),
  ('nav.pendientes','Navegación','Ver Pendientes'),
  ('nav.actividad','Navegación','Ver Actividad'),
  ('nav.chat','Navegación','Ver Chat'),
  ('nav.recetas','Navegación','Ver Recetas'),
  ('nav.bodega','Navegación','Ver Bodega'),
  ('nav.admin','Navegación','Ver Admin'),
  ('depositos.crear','Depósitos','Crear depósitos'),
  ('depositos.editar','Depósitos','Editar depósitos'),
  ('depositos.eliminar','Depósitos','Eliminar depósitos'),
  ('depositos.mover','Depósitos','Mover depósitos en mapa'),
  ('depositos.capacidad','Depósitos','Editar capacidades'),
  ('movimientos.crear','Movimientos','Crear movimientos'),
  ('movimientos.editar','Movimientos','Editar movimientos'),
  ('movimientos.eliminar','Movimientos','Eliminar movimientos'),
  ('movimientos.oficial','Movimientos','Marcar oficial'),
  ('movimientos.revisar','Movimientos','Revisar movimientos'),
  ('procesos.iniciar','Procesos','Iniciar procesos'),
  ('procesos.finalizar','Procesos','Finalizar procesos'),
  ('procesos.ver','Procesos','Ver procesos abiertos'),
  ('tareas.crear','Tareas','Crear tareas'),
  ('tareas.asignar','Tareas','Asignar tareas'),
  ('tareas.finalizar','Tareas','Finalizar tareas'),
  ('tareas.editar','Tareas','Editar tareas'),
  ('recetas.crear','Recetas','Crear recetas'),
  ('recetas.editar','Recetas','Editar recetas'),
  ('recetas.eliminar','Recetas','Eliminar recetas'),
  ('recetas.usar','Recetas','Usar recetas'),
  ('usuarios.crear','Usuarios','Crear usuarios'),
  ('usuarios.editar','Usuarios','Editar usuarios'),
  ('usuarios.eliminar','Usuarios','Eliminar usuarios'),
  ('usuarios.rol','Usuarios','Cambiar roles'),
  ('chat.grupos.crear','Chat','Crear grupos'),
  ('chat.grupos.eliminar','Chat','Eliminar grupos'),
  ('chat.enviar','Chat','Enviar mensajes')
on conflict (key) do nothing;

-- =========================================================
--  SEED: roles del sistema (bodega_id = null = plantilla)
-- =========================================================
insert into public.roles (bodega_id, key, nombre, color, icono, descripcion, is_system, activo) values
  (null,'admin','Administrador','#9f1239','ShieldCheck','Acceso total al sistema',true,true),
  (null,'responsable','Responsable','#2563eb','UserCog','Gestiona operaciones y movimientos',true,true),
  (null,'enologo','Enólogo','#7c3aed','FlaskConical','Gestiona tareas y elaboraciones',true,true),
  (null,'operario','Operario','#16a34a','HardHat','Ejecuta trabajos asignados',true,true),
  (null,'limpieza','Limpieza','#0ea5e9','Sparkles','Limpieza de depósitos',true,true),
  (null,'embotellado','Embotellado','#d97706','Wine','Procesos de embotellado',true,true),
  (null,'auditor','Auditor','#64748b','Eye','Solo lectura y revisión',true,true)
on conflict do nothing;

-- =========================================================
--  SEED: role_permissions de plantillas
-- =========================================================
-- admin: todos
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'admin'
on conflict do nothing;

-- responsable
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'responsable'
   and p.key in (
     'nav.inicio','nav.mapa','nav.trabajos','nav.pendientes','nav.actividad','nav.chat','nav.recetas','nav.bodega',
     'depositos.editar','depositos.mover',
     'movimientos.crear','movimientos.editar','movimientos.oficial','movimientos.revisar',
     'procesos.iniciar','procesos.finalizar','procesos.ver',
     'tareas.crear','tareas.asignar','tareas.finalizar','tareas.editar',
     'recetas.usar','chat.enviar','chat.grupos.crear'
   )
on conflict do nothing;

-- enologo
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'enologo'
   and p.key in (
     'nav.inicio','nav.mapa','nav.trabajos','nav.pendientes','nav.actividad','nav.chat','nav.recetas','nav.bodega',
     'procesos.iniciar','procesos.finalizar','procesos.ver',
     'tareas.crear','tareas.asignar','tareas.editar',
     'recetas.crear','recetas.editar','recetas.usar',
     'movimientos.crear','chat.enviar'
   )
on conflict do nothing;

-- operario
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'operario'
   and p.key in (
     'nav.inicio','nav.mapa','nav.trabajos','nav.pendientes','nav.actividad','nav.chat',
     'tareas.finalizar','procesos.ver','chat.enviar'
   )
on conflict do nothing;

-- limpieza
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'limpieza'
   and p.key in ('nav.inicio','nav.mapa','nav.trabajos','nav.chat','tareas.finalizar','chat.enviar')
on conflict do nothing;

-- embotellado
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'embotellado'
   and p.key in ('nav.inicio','nav.mapa','nav.trabajos','nav.pendientes','nav.chat','tareas.finalizar','procesos.ver','chat.enviar')
on conflict do nothing;

-- auditor
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
 where r.bodega_id is null and r.key = 'auditor'
   and p.key in ('nav.inicio','nav.mapa','nav.actividad','nav.bodega','nav.recetas','procesos.ver')
on conflict do nothing;
