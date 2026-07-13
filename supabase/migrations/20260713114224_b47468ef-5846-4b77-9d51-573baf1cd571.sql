
-- 1. Add trabajo_tipo values
ALTER TYPE trabajo_tipo ADD VALUE IF NOT EXISTS 'carga';
ALTER TYPE trabajo_tipo ADD VALUE IF NOT EXISTS 'descarga';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE orden_logistica_tipo AS ENUM ('carga','descarga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE orden_logistica_estado AS ENUM (
    'borrador','programada','pendiente_laboratorio','autorizada','en_proceso','completada','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE orden_lab_estado AS ENUM ('pendiente','autorizado','rechazado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Main table
CREATE TABLE IF NOT EXISTS public.ordenes_logisticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  trabajo_id uuid REFERENCES public.trabajos(id) ON DELETE CASCADE,
  calendario_evento_id uuid REFERENCES public.calendario_eventos(id) ON DELETE SET NULL,
  tipo orden_logistica_tipo NOT NULL,
  estado orden_logistica_estado NOT NULL DEFAULT 'borrador',
  prioridad text NOT NULL DEFAULT 'normal',

  proceso_documental_id uuid REFERENCES public.procesos_documentales(id) ON DELETE SET NULL,
  proceso_codigo_snapshot text,
  proceso_version_snapshot text,
  proceso_nombre_snapshot text,

  numero_operacion text,
  fecha_programada date,
  hora_programada time,
  fecha_inicio_real timestamptz,
  fecha_fin_real timestamptz,

  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  lote_id uuid REFERENCES public.producto_lotes(id) ON DELETE SET NULL,
  categoria text,
  campana text,
  deposito_origen_id text,
  deposito_destino_id text,
  litros_previstos numeric(12,2),
  litros_reales numeric(12,2),
  grado numeric(5,2),

  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
  contrato_compra_id uuid REFERENCES public.contratos_compra(id) ON DELETE SET NULL,
  contrato_venta_id uuid REFERENCES public.contratos_venta(id) ON DELETE SET NULL,

  transportista text,
  empresa_transportista text,
  matricula text,
  remolque_matricula text,
  conductor_nombre text,
  conductor_documento text,
  conductor_telefono text,
  numero_precinto text,
  precintos_adicionales text,

  -- JSON blocks
  comprobaciones jsonb NOT NULL DEFAULT '[]'::jsonb,      -- lista de checks previos
  instrucciones jsonb NOT NULL DEFAULT '{}'::jsonb,       -- LOT/CAD/PROV, organoléptico, especificaciones
  limpieza_epis jsonb NOT NULL DEFAULT '{}'::jsonb,       -- limpieza confirmada, epis, observaciones
  declaracion_transportista jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Autorización laboratorio
  lab_estado orden_lab_estado NOT NULL DEFAULT 'pendiente',
  lab_autorizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lab_autorizado_cargo text,
  lab_autorizado_at timestamptz,
  lab_observaciones text,

  observaciones text,
  motivo_cancelacion text,

  movimiento_id uuid REFERENCES public.movimientos(id) ON DELETE SET NULL,

  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordenes_logisticas TO authenticated;
GRANT ALL ON public.ordenes_logisticas TO service_role;

ALTER TABLE public.ordenes_logisticas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordenes_log select members" ON public.ordenes_logisticas
  FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()));

CREATE POLICY "ordenes_log insert members" ON public.ordenes_logisticas
  FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT current_user_bodegas()) AND created_by = auth.uid());

CREATE POLICY "ordenes_log update members" ON public.ordenes_logisticas
  FOR UPDATE TO authenticated
  USING (bodega_id IN (SELECT current_user_bodegas()));

CREATE POLICY "ordenes_log delete admin" ON public.ordenes_logisticas
  FOR DELETE TO authenticated
  USING (is_bodega_admin(bodega_id));

CREATE INDEX IF NOT EXISTS idx_ordenes_log_bodega ON public.ordenes_logisticas(bodega_id, estado, fecha_programada DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ordenes_log_trabajo ON public.ordenes_logisticas(trabajo_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_log_evento ON public.ordenes_logisticas(calendario_evento_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_log_lote ON public.ordenes_logisticas(lote_id);

CREATE TRIGGER trg_ordenes_log_updated
  BEFORE UPDATE ON public.ordenes_logisticas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Compartimentos
CREATE TABLE IF NOT EXISTS public.orden_compartimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES public.ordenes_logisticas(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  lote_id uuid REFERENCES public.producto_lotes(id) ON DELETE SET NULL,
  deposito_id text,
  litros_previstos numeric(12,2),
  litros_reales numeric(12,2),
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orden_compartimentos TO authenticated;
GRANT ALL ON public.orden_compartimentos TO service_role;

ALTER TABLE public.orden_compartimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orden_compart all members" ON public.orden_compartimentos
  FOR ALL TO authenticated
  USING (orden_id IN (SELECT id FROM public.ordenes_logisticas WHERE bodega_id IN (SELECT current_user_bodegas())))
  WITH CHECK (orden_id IN (SELECT id FROM public.ordenes_logisticas WHERE bodega_id IN (SELECT current_user_bodegas())));

CREATE INDEX IF NOT EXISTS idx_orden_compart_orden ON public.orden_compartimentos(orden_id);

CREATE TRIGGER trg_orden_compart_updated
  BEFORE UPDATE ON public.orden_compartimentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Link analiticas_lote → orden
ALTER TABLE public.analiticas_lote
  ADD COLUMN IF NOT EXISTS orden_logistica_id uuid REFERENCES public.ordenes_logisticas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_analiticas_orden ON public.analiticas_lote(orden_logistica_id);
