
INSERT INTO public.permissions (key, label, descripcion, categoria)
VALUES
  ('calendario.editar', 'Editar calendario', 'Crear y editar eventos del calendario', 'calendario'),
  ('calendario.ver_todos', 'Ver todos los eventos', 'Ver todos los eventos del calendario (no solo los asignados)', 'calendario')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
  FROM public.roles r
  CROSS JOIN (VALUES ('calendario.editar'),('calendario.ver_todos')) AS p(key)
 WHERE r.key IN ('admin','responsable','enologo')
ON CONFLICT DO NOTHING;
