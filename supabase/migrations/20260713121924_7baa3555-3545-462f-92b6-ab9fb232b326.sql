
-- 1) Nuevos estados en el enum de órdenes logísticas
ALTER TYPE public.orden_logistica_estado ADD VALUE IF NOT EXISTS 'pendiente_confirmacion';
ALTER TYPE public.orden_logistica_estado ADD VALUE IF NOT EXISTS 'cerrada';
ALTER TYPE public.orden_logistica_estado ADD VALUE IF NOT EXISTS 'rechazada';
ALTER TYPE public.orden_logistica_estado ADD VALUE IF NOT EXISTS 'rectificada';

-- 2) Tolerancia configurable por bodega para suma de compartimentos
ALTER TABLE public.bodegas
  ADD COLUMN IF NOT EXISTS tolerancia_compartimentos_pct numeric NOT NULL DEFAULT 0.5;

-- 3) Nuevos campos operativos en ordenes_logisticas
ALTER TABLE public.ordenes_logisticas
  ADD COLUMN IF NOT EXISTS iniciado_por uuid,
  ADD COLUMN IF NOT EXISTS iniciado_at timestamptz,
  ADD COLUMN IF NOT EXISTS pendiente_confirmacion_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS rechazada_por uuid,
  ADD COLUMN IF NOT EXISTS rechazada_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS cerrada_at timestamptz,
  ADD COLUMN IF NOT EXISTS orden_original_id uuid REFERENCES public.ordenes_logisticas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_rectificacion text,
  ADD COLUMN IF NOT EXISTS rectificada_por uuid,
  ADD COLUMN IF NOT EXISTS rectificada_at timestamptz,
  ADD COLUMN IF NOT EXISTS lab_excepcion jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS validation_snapshot jsonb;

-- 4) Un solo movimiento por orden (idempotencia dura)
CREATE UNIQUE INDEX IF NOT EXISTS ordenes_logisticas_movimiento_uniq
  ON public.ordenes_logisticas(movimiento_id)
  WHERE movimiento_id IS NOT NULL;

-- 5) Permisos granulares para Fase 2
INSERT INTO public.permissions (key, categoria, label, descripcion) VALUES
  ('ordenes.carga.iniciar',        'Órdenes logísticas', 'Iniciar carga',        'Pasar una orden de carga a En proceso'),
  ('ordenes.carga.confirmar',      'Órdenes logísticas', 'Confirmar carga',      'Confirmación final que crea movimiento y actualiza stock'),
  ('ordenes.carga.rectificar',     'Órdenes logísticas', 'Rectificar carga',     'Rectificar una carga completada o cerrada'),
  ('ordenes.descarga.iniciar',     'Órdenes logísticas', 'Iniciar descarga',     'Pasar una orden de descarga a En proceso'),
  ('ordenes.descarga.confirmar',   'Órdenes logísticas', 'Confirmar descarga',   'Confirmación final que crea movimiento y actualiza stock'),
  ('ordenes.descarga.rectificar',  'Órdenes logísticas', 'Rectificar descarga',  'Rectificar una descarga completada o cerrada'),
  ('laboratorio.ordenes.authorize','Laboratorio',        'Autorizar laboratorio','Autorizar y aplicar excepciones de analíticas en órdenes')
ON CONFLICT (key) DO NOTHING;

-- 6) Asignar los nuevos permisos por defecto a roles admin / responsable / enologo
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
  FROM public.roles r
  CROSS JOIN (VALUES
    ('ordenes.carga.iniciar'),
    ('ordenes.carga.confirmar'),
    ('ordenes.carga.rectificar'),
    ('ordenes.descarga.iniciar'),
    ('ordenes.descarga.confirmar'),
    ('ordenes.descarga.rectificar'),
    ('laboratorio.ordenes.authorize')
  ) AS p(key)
 WHERE r.key IN ('admin','responsable','enologo')
ON CONFLICT DO NOTHING;
