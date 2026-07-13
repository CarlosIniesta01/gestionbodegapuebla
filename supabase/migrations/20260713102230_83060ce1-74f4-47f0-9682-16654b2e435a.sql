
-- 1) Procesos documentales (catálogo por bodega para carga/descarga)
CREATE TABLE public.procesos_documentales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('carga','descarga')),
  categoria_producto text,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  version text NOT NULL DEFAULT '1',
  fecha_vigencia date,
  es_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, codigo, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procesos_documentales TO authenticated;
GRANT ALL ON public.procesos_documentales TO service_role;
ALTER TABLE public.procesos_documentales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procesos_select" ON public.procesos_documentales FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "procesos_write" ON public.procesos_documentales FOR ALL TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()))
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE TRIGGER trg_procesos_upd BEFORE UPDATE ON public.procesos_documentales
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Plantillas analíticas
CREATE TABLE public.plantillas_analitica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria_producto text,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  es_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantillas_analitica TO authenticated;
GRANT ALL ON public.plantillas_analitica TO service_role;
ALTER TABLE public.plantillas_analitica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plantillas_select" ON public.plantillas_analitica FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY "plantillas_write" ON public.plantillas_analitica FOR ALL TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()))
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE TRIGGER trg_plantillas_upd BEFORE UPDATE ON public.plantillas_analitica
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Parámetros de plantilla
CREATE TABLE public.plantilla_analitica_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid NOT NULL REFERENCES public.plantillas_analitica(id) ON DELETE CASCADE,
  parametro text NOT NULL,
  unidad text,
  minimo numeric,
  maximo numeric,
  obligatorio boolean NOT NULL DEFAULT false,
  metodo text,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantilla_analitica_parametros TO authenticated;
GRANT ALL ON public.plantilla_analitica_parametros TO service_role;
ALTER TABLE public.plantilla_analitica_parametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plantparam_select" ON public.plantilla_analitica_parametros FOR SELECT TO authenticated
  USING (plantilla_id IN (SELECT id FROM public.plantillas_analitica WHERE bodega_id IN (SELECT public.current_user_bodegas())));
CREATE POLICY "plantparam_write" ON public.plantilla_analitica_parametros FOR ALL TO authenticated
  USING (plantilla_id IN (SELECT id FROM public.plantillas_analitica WHERE bodega_id IN (SELECT public.current_user_bodegas())))
  WITH CHECK (plantilla_id IN (SELECT id FROM public.plantillas_analitica WHERE bodega_id IN (SELECT public.current_user_bodegas())));
CREATE TRIGGER trg_plantparam_upd BEFORE UPDATE ON public.plantilla_analitica_parametros
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Extender analiticas_lote con campos de plantilla + validación + autorización
ALTER TABLE public.analiticas_lote
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.calendario_eventos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plantilla_id uuid REFERENCES public.plantillas_analitica(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS minimo numeric,
  ADD COLUMN IF NOT EXISTS maximo numeric,
  ADD COLUMN IF NOT EXISTS metodo text,
  ADD COLUMN IF NOT EXISTS obligatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orden_num int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autorizado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_autorizacion text;
CREATE INDEX IF NOT EXISTS idx_analiticas_evento ON public.analiticas_lote(evento_id);

-- 5) Extender calendario_eventos con proceso documental (snapshot código + versión + id)
ALTER TABLE public.calendario_eventos
  ADD COLUMN IF NOT EXISTS proceso_id uuid REFERENCES public.procesos_documentales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proceso_codigo text,
  ADD COLUMN IF NOT EXISTS proceso_version text;

-- 6) Seeds: procesos + plantillas + parámetros para cada bodega existente
DO $$
DECLARE
  b RECORD;
  pl_id uuid;
BEGIN
  FOR b IN SELECT id FROM public.bodegas LOOP
    -- Procesos por defecto
    INSERT INTO public.procesos_documentales (bodega_id, codigo, nombre, tipo, es_default, activo)
    VALUES
      (b.id, 'DP-10-03/4', 'Orden de carga (procedimiento general)', 'carga', true, true),
      (b.id, 'DP-11-02/4', 'Orden de descarga (procedimiento general)', 'descarga', true, true)
    ON CONFLICT (bodega_id, codigo, version) DO NOTHING;

    -- Plantilla: Descarga básica
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, descripcion, es_default, activo)
    VALUES (b.id, 'Descarga básica', 'Plantilla predeterminada de descarga', true, true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Grado alcohólico', '% vol', true, 1),
      (pl_id, 'Acidez total', 'g/L', true, 2),
      (pl_id, 'Acidez volátil', 'g/L', true, 3),
      (pl_id, 'Organoléptica', NULL, true, 4);

    -- Plantilla: Recepción vino tinto
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, categoria_producto, activo)
    VALUES (b.id, 'Recepción vino tinto', 'vino_tinto', true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Grado alcohólico', '% vol', true, 1),
      (pl_id, 'pH', NULL, true, 2),
      (pl_id, 'Acidez total', 'g/L', true, 3),
      (pl_id, 'Acidez volátil', 'g/L', true, 4),
      (pl_id, 'SO2 libre', 'mg/L', true, 5),
      (pl_id, 'SO2 total', 'mg/L', true, 6),
      (pl_id, 'Color', NULL, false, 7),
      (pl_id, 'Organoléptica', NULL, true, 8);

    -- Plantilla: Recepción vino blanco
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, categoria_producto, activo)
    VALUES (b.id, 'Recepción vino blanco', 'vino_blanco', true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Grado alcohólico', '% vol', true, 1),
      (pl_id, 'pH', NULL, true, 2),
      (pl_id, 'Acidez total', 'g/L', true, 3),
      (pl_id, 'Acidez volátil', 'g/L', true, 4),
      (pl_id, 'SO2 libre', 'mg/L', true, 5),
      (pl_id, 'SO2 total', 'mg/L', true, 6),
      (pl_id, 'Turbidez', 'NTU', false, 7),
      (pl_id, 'Organoléptica', NULL, true, 8);

    -- Plantilla: Recepción mosto
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, categoria_producto, activo)
    VALUES (b.id, 'Recepción mosto', 'mosto', true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Densidad', 'g/L', true, 1),
      (pl_id, 'Azúcares', 'g/L', true, 2),
      (pl_id, 'pH', NULL, true, 3),
      (pl_id, 'Acidez total', 'g/L', true, 4),
      (pl_id, 'Temperatura', '°C', false, 5),
      (pl_id, 'Organoléptica', NULL, true, 6);

    -- Plantilla: Recepción alcohol
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, categoria_producto, activo)
    VALUES (b.id, 'Recepción alcohol', 'alcohol', true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Grado alcohólico', '% vol', true, 1),
      (pl_id, 'Densidad', 'g/L', true, 2),
      (pl_id, 'Organoléptica', NULL, true, 3);

    -- Plantilla: Recepción producto terminado
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, categoria_producto, activo)
    VALUES (b.id, 'Recepción producto terminado', 'producto_terminado', true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Grado alcohólico', '% vol', true, 1),
      (pl_id, 'pH', NULL, false, 2),
      (pl_id, 'Acidez total', 'g/L', false, 3),
      (pl_id, 'SO2 libre', 'mg/L', true, 4),
      (pl_id, 'SO2 total', 'mg/L', true, 5),
      (pl_id, 'Turbidez', 'NTU', false, 6),
      (pl_id, 'Organoléptica', NULL, true, 7);

    -- Plantilla: Control completo de laboratorio
    INSERT INTO public.plantillas_analitica (bodega_id, nombre, descripcion, activo)
    VALUES (b.id, 'Control completo de laboratorio', 'Analítica completa', true)
    RETURNING id INTO pl_id;
    INSERT INTO public.plantilla_analitica_parametros (plantilla_id, parametro, unidad, obligatorio, orden) VALUES
      (pl_id, 'Grado alcohólico', '% vol', true, 1),
      (pl_id, 'pH', NULL, true, 2),
      (pl_id, 'Acidez total', 'g/L', true, 3),
      (pl_id, 'Acidez volátil', 'g/L', true, 4),
      (pl_id, 'SO2 libre', 'mg/L', true, 5),
      (pl_id, 'SO2 total', 'mg/L', true, 6),
      (pl_id, 'Densidad', 'g/L', false, 7),
      (pl_id, 'Azúcares', 'g/L', false, 8),
      (pl_id, 'Turbidez', 'NTU', false, 9),
      (pl_id, 'Color', NULL, false, 10),
      (pl_id, 'Temperatura', '°C', false, 11),
      (pl_id, 'Organoléptica', NULL, true, 12);
  END LOOP;
END $$;
