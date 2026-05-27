# Plan: Usuarios, Roles y Permisos

Activamos **Lovable Cloud** (PostgreSQL + Auth + RLS + Realtime). Sin él no hay multi-bodega seguro.

## 1. Modelo de datos (multi-tenant)

```text
organizations ── bodegas ── zonas / depositos / procesos / tareas / movimientos / recetas / mensajes
                    │
                    └── memberships (user_id, bodega_id, role_id, estado, ultima_conexion)
                            │
                            └── membership_zonas (membership_id, zona_id)   ← limita por zonas

profiles (user_id PK→auth.users, nombre, avatar_url, telefono, email)
roles (id, bodega_id NULL=global, key, nombre, color, icono, descripcion, is_system, activo)
permissions (key PK, categoria, label)            ← catálogo fijo seedeado
role_permissions (role_id, permission_key)        ← N:N configurable
```

- `estado` membership: `activo | inactivo | suspendido`.
- Permisos viven en `role_permissions` (no en código). Catálogo `permissions` seedeado con todas las keys del briefing (nav.*, depositos.*, movimientos.*, procesos.*, tareas.*, recetas.*, usuarios.*, chat.*).
- 7 roles del sistema seed: `admin, responsable, enologo, operario, limpieza, embotellado, auditor` (con color/icono). Admin puede duplicar/editar/crear/desactivar excepto los marcados `is_system` en operaciones destructivas.

## 2. Seguridad (RLS + SECURITY DEFINER)

Funciones `SECURITY DEFINER SET search_path = public`:

- `current_membership(bodega uuid) → memberships row`
- `has_permission(bodega uuid, perm text) → boolean` (join memberships→role_permissions)
- `is_admin(bodega uuid) → boolean`
- `user_zonas(bodega uuid) → setof uuid` (zonas asignadas, vacío = todas)

Patrón RLS en todas las tablas de negocio:
```sql
USING (bodega_id IN (SELECT bodega_id FROM memberships WHERE user_id = auth.uid() AND estado='activo'))
WITH CHECK (has_permission(bodega_id, 'depositos.crear'))
```
Tablas con zona añaden `AND (zona_id IS NULL OR zona_id IN (SELECT user_zonas(bodega_id)))`.

`GRANT SELECT,INSERT,UPDATE,DELETE … TO authenticated` + `GRANT ALL … TO service_role` en cada tabla pública. Sin `anon`.

## 3. Frontend

**Auth**
- Email+password + Google (vía broker Lovable). Página `/login`, `/reset-password`.
- Layout `_authenticated` con gate sincrónico + `beforeLoad` que hace `supabase.auth.getUser()`.
- Selector de bodega en header si el usuario tiene varias memberships.

**Contexto de permisos**
- `useServerFn(getMyContext)` carga: `profile, bodega_activa, role, permissions[], zonas[]`.
- Hook `usePermission('depositos.editar')` y `<Can perm="…">children</Can>`.
- Navegación lateral/inferior filtra items por `nav.*`.

**Módulo `/admin/usuarios`** (gated por `usuarios.editar`)
- Tabla responsive: avatar, nombre, email, **badge de rol con color+icono**, estado, última conexión, tareas activas, bodega.
- Acciones: crear (invita por email + contraseña temporal), editar, cambiar rol, asignar zonas (multi-select visual sobre mini-mapa), suspender/activar, reset password, eliminar membership.

**Módulo `/admin/roles`**
- Cards de roles (color, icono, nº usuarios). Crear / duplicar / editar / activar.
- Editor de permisos: matriz agrupada por categoría con switches.

**Dashboards por rol** (`/` redirige según `role.key`)
- Operario: tareas pendientes + depósitos asignados.
- Enólogo: vista rápida “crear tarea / solicitar trasiego / elaboración” + procesos activos + incidencias.
- Responsable: actividad + procesos + movimientos pendientes.
- Administrador: KPIs globales + accesos a usuarios/roles.

**Badge de rol** reutilizable mostrado en chat, tareas, actividad, listado usuarios.

## 4. Server functions (TanStack)

`src/lib/admin.functions.ts` (protegidas con `requireSupabaseAuth` + check `has_permission`):
- `getMyContext`, `listMembers`, `createMember` (admin client), `updateMemberRole`, `setMemberZonas`, `setMemberEstado`, `resetMemberPassword`, `deleteMember`.
- `listRoles`, `upsertRole`, `deleteRole`, `setRolePermissions`, `listPermissions`.

Las mutaciones que tocan `auth.users` (crear usuario, reset password) usan `supabaseAdmin` desde el handler.

## 5. Migración del mapa actual

El mock `bodega-data.ts` + `useBodegaMap` (localStorage) pasa a tablas `zonas` / `depositos` filtradas por `bodega_id`. Mantengo el mismo `BodegaCanvas`; cambio la fuente de datos a TanStack Query + serverFns. Drag & drop sólo si `has_permission('depositos.mover')`.

## 6. UI

Mismo lenguaje SCADA actual (dark, burdeos/ámbar, Space Grotesk/Inter). Componentes nuevos: `RoleBadge`, `PermissionMatrix`, `UserAvatar`, `ZoneAssigner`, `MemberRow`, `RoleCard`. Mobile-first con Drawer en <md.

## 7. Orden de implementación

1. Activar Lovable Cloud.
2. Migración SQL: tablas + seed roles/permissions + funciones SECURITY DEFINER + RLS + GRANTs.
3. Auth (login/registro/Google/reset) + `_authenticated` + selector de bodega + `getMyContext`.
4. `/admin/usuarios` y `/admin/roles` con todas las acciones.
5. Refactor de navegación y rutas existentes para usar `<Can>` + filtros por permiso.
6. Dashboards diferenciados por rol.
7. Migrar mapa a Cloud (zonas/depositos con `bodega_id`) y aplicar permisos sobre acciones (mover/editar/crear/eliminar depósito).

## Preguntas antes de empezar

1. **Onboarding de usuarios**: ¿crear por invitación (email con link Lovable Cloud) o que el admin defina contraseña temporal y la comparta manualmente?
2. **Google sign-in**: ¿lo activamos junto al email/password, o solo email/password?
3. **Multi-organización**: ¿un usuario puede pertenecer a varias bodegas/organizaciones a la vez, o uno-a-uno?
4. **Bodega inicial**: ¿creamos automáticamente una bodega “Mi Bodega” y conviertes al primer usuario en admin, o flujo de creación explícito?
