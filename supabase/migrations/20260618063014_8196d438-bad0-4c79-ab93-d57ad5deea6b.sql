-- Fase 1A: consolidar permisos de roles existentes (sin crear tablas nuevas).
-- Se aplica a TODAS las copias de rol (plantillas + por-bodega) usando r.key.

-- 1) ENÓLOGO: control total equivalente a admin.
WITH enologo_perms(perm) AS (
  VALUES
    ('nav.admin'),
    ('depositos.crear'), ('depositos.editar'), ('depositos.eliminar'),
    ('depositos.mover'), ('depositos.capacidad'),
    ('movimientos.editar'), ('movimientos.eliminar'),
    ('movimientos.oficial'), ('movimientos.revisar'),
    ('embotellado.create'),
    ('productos.manage'), ('productos.use'), ('productos.write'),
    ('recetas.read'), ('recetas.write'), ('recetas.use'), ('recetas.delete'),
    ('recetas.eliminar'),
    ('tareas.finalizar'),
    ('chat.grupos.crear'), ('chat.grupos.eliminar'),
    ('usuarios.crear'), ('usuarios.editar'), ('usuarios.eliminar'), ('usuarios.rol')
)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, ep.perm
  FROM public.roles r
  CROSS JOIN enologo_perms ep
 WHERE r.key = 'enologo'
ON CONFLICT DO NOTHING;

-- 2) ADMIN: añadir permisos "modernos" del catálogo que faltaban.
WITH admin_perms(perm) AS (
  VALUES
    ('productos.write'),
    ('recetas.read'), ('recetas.write'), ('recetas.use'), ('recetas.delete')
)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, ap.perm
  FROM public.roles r
  CROSS JOIN admin_perms ap
 WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- 3) OPERARIO (trabajador): mantener limitado, solo añadir consultas básicas.
WITH operario_perms(perm) AS (
  VALUES
    ('recetas.read'),
    ('productos.use')
)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, op.perm
  FROM public.roles r
  CROSS JOIN operario_perms op
 WHERE r.key = 'operario'
ON CONFLICT DO NOTHING;
