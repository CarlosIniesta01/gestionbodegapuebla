ALTER TYPE public.trabajo_tipo ADD VALUE IF NOT EXISTS 'operacion';

CREATE TABLE public.familias_operativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid REFERENCES public.bodegas(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  icono text NOT NULL DEFAULT 'Layers',
  color text NOT NULL DEFAULT '#475569',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.familias_operativas.bodega_id IS 'NULL = familia global del catálogo maestro; con valor = familia propia de un centro';

CREATE TABLE public.operaciones_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias_operativas(id),
  bodega_id uuid REFERENCES public.bodegas(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  requiere_deposito_origen boolean NOT NULL DEFAULT false,
  requiere_deposito_destino boolean NOT NULL DEFAULT false,
  requiere_producto boolean NOT NULL DEFAULT false,
  requiere_lote boolean NOT NULL DEFAULT false,
  requiere_operarios boolean NOT NULL DEFAULT true,
  requiere_laboratorio boolean NOT NULL DEFAULT false,
  admite_productos_enologicos boolean NOT NULL DEFAULT false,
  admite_consumos boolean NOT NULL DEFAULT false,
  admite_movimientos boolean NOT NULL DEFAULT false,
  admite_ejecucion_parcial boolean NOT NULL DEFAULT false,
  requiere_autorizacion boolean NOT NULL DEFAULT false,
  tipo_formulario text NOT NULL DEFAULT 'operacion'
    CHECK (tipo_formulario IN ('operacion','trasiego','vendimia','producto','limpieza','embotellado','carga','descarga','incidencia','observacion')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.operaciones_catalogo IS 'Catálogo de operaciones. Los campos requiere_/admite_ describen capacidades; no ejecutan acciones (Bloque A).';
CREATE INDEX idx_operaciones_catalogo_familia ON public.operaciones_catalogo(familia_id);

CREATE TABLE public.centro_operaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  operacion_id uuid NOT NULL REFERENCES public.operaciones_catalogo(id),
  habilitada boolean NOT NULL DEFAULT true,
  configuracion jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, operacion_id)
);
COMMENT ON TABLE public.centro_operaciones IS 'Habilitación por centro. Sin fila = habilitada por defecto.';

ALTER TABLE public.trabajos ADD COLUMN operacion_catalogo_id uuid REFERENCES public.operaciones_catalogo(id);
CREATE INDEX idx_trabajos_operacion ON public.trabajos(operacion_catalogo_id);

GRANT SELECT, INSERT, UPDATE ON public.familias_operativas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.operaciones_catalogo TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.centro_operaciones TO authenticated;
GRANT ALL ON public.familias_operativas, public.operaciones_catalogo, public.centro_operaciones TO service_role;

CREATE OR REPLACE FUNCTION public.has_permission_any(_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    WHERE m.user_id = auth.uid() AND m.estado = 'activo' AND rp.permission_key = _perm);
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission_any(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission_any(text) TO authenticated;

ALTER TABLE public.familias_operativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operaciones_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centro_operaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY fam_select ON public.familias_operativas FOR SELECT TO authenticated
  USING (bodega_id IS NULL OR bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY fam_insert ON public.familias_operativas FOR INSERT TO authenticated
  WITH CHECK (bodega_id IS NOT NULL AND public.has_permission(bodega_id, 'operaciones.catalogo.create'));
CREATE POLICY fam_update ON public.familias_operativas FOR UPDATE TO authenticated
  USING ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.edit'))
      OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id, 'operaciones.catalogo.edit')))
  WITH CHECK ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.edit'))
      OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id, 'operaciones.catalogo.edit')));

CREATE POLICY op_select ON public.operaciones_catalogo FOR SELECT TO authenticated
  USING (bodega_id IS NULL OR bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY op_insert ON public.operaciones_catalogo FOR INSERT TO authenticated
  WITH CHECK (bodega_id IS NOT NULL AND public.has_permission(bodega_id, 'operaciones.catalogo.create'));
CREATE POLICY op_update ON public.operaciones_catalogo FOR UPDATE TO authenticated
  USING ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.edit'))
      OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id, 'operaciones.catalogo.edit')))
  WITH CHECK ((bodega_id IS NULL AND public.has_permission_any('operaciones.catalogo.edit'))
      OR (bodega_id IS NOT NULL AND public.has_permission(bodega_id, 'operaciones.catalogo.edit')));

CREATE POLICY co_select ON public.centro_operaciones FOR SELECT TO authenticated
  USING (bodega_id IN (SELECT public.current_user_bodegas()));
CREATE POLICY co_insert ON public.centro_operaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(bodega_id, 'operaciones.centros.configure'));
CREATE POLICY co_update ON public.centro_operaciones FOR UPDATE TO authenticated
  USING (public.has_permission(bodega_id, 'operaciones.centros.configure'))
  WITH CHECK (public.has_permission(bodega_id, 'operaciones.centros.configure'));

CREATE TRIGGER trg_fam_touch BEFORE UPDATE ON public.familias_operativas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_op_touch BEFORE UPDATE ON public.operaciones_catalogo FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_co_touch BEFORE UPDATE ON public.centro_operaciones FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fam_audit AFTER INSERT OR UPDATE ON public.familias_operativas FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();
CREATE TRIGGER trg_op_audit AFTER INSERT OR UPDATE ON public.operaciones_catalogo FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();
CREATE TRIGGER trg_co_audit AFTER INSERT OR UPDATE ON public.centro_operaciones FOR EACH ROW EXECUTE FUNCTION public.audit_producto_generic();

INSERT INTO public.permissions (key, label, categoria, descripcion) VALUES
  ('operaciones.catalogo.read','Consultar catálogo de operaciones','Operaciones','Ver familias y operaciones'),
  ('operaciones.catalogo.create','Crear familias/operaciones','Operaciones','Añadir nuevas familias u operaciones al catálogo'),
  ('operaciones.catalogo.edit','Editar catálogo de operaciones','Operaciones','Modificar familias y operaciones'),
  ('operaciones.catalogo.disable','Activar/desactivar operaciones','Operaciones','Activar o desactivar familias y operaciones'),
  ('operaciones.centros.configure','Configurar operaciones por centro','Operaciones','Habilitar o deshabilitar operaciones en un centro')
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r
CROSS JOIN (VALUES ('operaciones.catalogo.read'),('operaciones.catalogo.create'),('operaciones.catalogo.edit'),('operaciones.catalogo.disable'),('operaciones.centros.configure')) AS p(key)
WHERE r.key IN ('admin','enologo') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r
CROSS JOIN (VALUES ('operaciones.catalogo.read'),('operaciones.centros.configure')) AS p(key)
WHERE r.key = 'responsable' ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'operaciones.catalogo.read' FROM public.roles r
WHERE r.key NOT IN ('admin','enologo','responsable') ON CONFLICT DO NOTHING;

INSERT INTO public.familias_operativas (codigo,nombre,icono,color,orden) VALUES
('F01','Recepción de uva','Grape','#7a3e9d',10),
('F02','Recepción de mosto, vino y alcohol','PackageOpen','#2563eb',20),
('F03','Elaboración de blancos y rosados','Wine','#ca8a04',30),
('F04','Elaboración de tintos','Wine','#9f1239',40),
('F05','Fermentaciones','FlaskRound','#c2410c',50),
('F06','Movimientos entre depósitos','Droplets','#0891b2',60),
('F07','Mezclas y ajustes enológicos','Blend','#7c3aed',70),
('F08','Clarificación y afinado','Filter','#0d9488',80),
('F09','Estabilización y filtración','Funnel','#475569',90),
('F10','Conservación y almacenamiento','Warehouse','#57534e',100),
('F11','Laboratorio y controles analíticos','FlaskConical','#16a34a',110),
('F12','Preparación y expedición a granel','Truck','#1d4ed8',120),
('F13','Embotellado y acondicionamiento','Package','#be185d',130),
('F14','Limpieza, desinfección e higiene','Sparkles','#0ea5e9',140),
('F15','Mantenimiento y calibraciones','Wrench','#6b7280',150),
('F16','Gestión de subproductos y residuos','Recycle','#65a30d',160),
('F17','Calidad y seguridad alimentaria','ShieldCheck','#b91c1c',170),
('F18','Operaciones especiales y otros centros','Settings2','#334155',180)
ON CONFLICT DO NOTHING;

WITH src(fam, ops) AS (VALUES
('F01',ARRAY['Pesaje de entrada','Pesaje de salida','Identificación de proveedor y parcela','Identificación de variedad','Toma de muestras','Control de madurez','Control sanitario','Descarga en tolva','Clasificación de uva','Asignación de lote','Registro de kilos','Control de rendimientos']),
('F02',ARRAY['Recepción de cisterna','Comprobación documental','Inspección de limpieza','Verificación de precintos','Toma de muestras','Análisis de recepción','Control organoléptico','Autorización de laboratorio','Descarga a depósito','Registro de litros','Registro de lote','Incidencia de recepción']),
('F03',ARRAY['Despalillado','Estrujado','Maceración pelicular','Escurrido','Prensado','Separación de mosto yema','Separación de mosto prensa','Sulfitado','Desfangado estático','Flotación','Adición de coadyuvantes','Separación de fangos','Traslado a fermentación']),
('F04',ARRAY['Despalillado','Estrujado','Encubado','Maceración','Remontado','Bazuqueo','Delestage','Control de temperatura','Descube','Prensado de orujos','Separación de vino yema','Separación de vino prensa','Gestión de lías']),
('F05',ARRAY['Preparación de levaduras','Rehidratación','Inoculación','Adición de nutrientes','Control de densidad','Control de temperatura','Control de azúcares','Aireación','Seguimiento de fermentación alcohólica','Seguimiento de fermentación maloláctica','Control de desviaciones','Confirmación de final de fermentación']),
('F06',ARRAY['Trasiego total','Trasiego parcial','Separación de lías','Reparto entre depósitos','Llenado','Vaciado','Trasvase','Traslado entre centros','Recirculación','Homogeneización']),
('F07',ARRAY['Ensayos de coupage','Mezcla de partidas','Corrección de sulfuroso','Corrección de acidez','Ajustes de grado autorizados','Adición de productos','Homogeneización','Verificación analítica']),
('F08',ARRAY['Ensayos de clarificación','Preparación de clarificantes','Adición de proteína vegetal','Adición de bentonita','Adición de PVPP','Adición de gelatinas','Adición de otros clarificantes','Homogeneización','Control de tiempo de contacto','Sedimentación','Separación de sólidos','Evaluación organoléptica']),
('F09',ARRAY['Ensayos de estabilidad','Estabilización proteica','Estabilización tartárica','Centrifugación','Filtración con tierras','Filtración por placas','Filtración lenticular','Filtración tangencial','Filtración por membranas','Control de turbidez','Control de presión','Control de caudal','Registro de mermas']),
('F10',ARRAY['Inspección de depósitos','Control de llenado','Rellenos','Inertización','Control de temperatura','Control de sulfuroso','Control de oxígeno','Toma de muestras','Catas','Seguimiento de evolución','Inmovilización de partidas','Liberación autorizada']),
('F11',ARRAY['Toma de muestras','Analíticas fisicoquímicas','Analíticas microbiológicas','Controles organolépticos','Ensayos de estabilidad','Control de recepción','Control previo a expedición','Validación de resultados','Autorización de operaciones']),
('F12',ARRAY['Preparación de lote','Verificación de contrato','Verificación de especificaciones','Analítica previa','Comprobación de cisterna','Carga por compartimentos','Medición de litros','Toma de muestra testigo','Precintado','Documentación','Expedición']),
('F13',ARRAY['Preparación de línea','Preparación de materiales','Filtración previa','Llenado','Taponado','Etiquetado','Codificación de lotes','Encajado','Paletizado','Controles de calidad','Registro de unidades','Expedición de producto terminado']),
('F14',ARRAY['Limpieza de depósitos','Limpieza de cisternas','Limpieza de mangueras','Limpieza de tuberías','Limpieza de bombas','Limpieza de filtros','Limpieza de líneas','Programas CIP','Desinfección','Aclarados','Verificación de limpieza','Liberación de equipos']),
('F15',ARRAY['Mantenimiento preventivo','Mantenimiento correctivo','Reparación de bombas','Reparación de válvulas','Inspección de depósitos','Calibración de básculas','Calibración de equipos','Registro de averías','Verificación de funcionamiento']),
('F16',ARRAY['Gestión de orujos','Gestión de lías','Gestión de fangos','Elaboración y gestión de piquetas','Gestión de aguas de proceso','Registro de mermas','Retirada de residuos','Valorización de subproductos']),
('F17',ARRAY['Controles APPCC','Inspecciones','Verificaciones','No conformidades','Acciones correctivas','Acciones preventivas','Auditorías','Reclamaciones','Bloqueo de productos','Liberación de productos','Homologación de proveedores']),
('F18',ARRAY['Desulfitado','Concentración de mostos','Elaboración de mistelas','Encabezado','Dilución de alcoholes','Preparación de bebidas derivadas','Operaciones de alcoholera','Otros procesos configurables'])
), x AS (
  SELECT s.fam, o.nombre, o.n FROM src s, unnest(s.ops) WITH ORDINALITY AS o(nombre, n)
)
INSERT INTO public.operaciones_catalogo (familia_id, codigo, nombre, orden,
  requiere_deposito_origen, requiere_deposito_destino, requiere_producto, requiere_lote,
  requiere_operarios, requiere_laboratorio, admite_productos_enologicos, admite_consumos,
  admite_movimientos, admite_ejecucion_parcial, requiere_autorizacion, tipo_formulario)
SELECT f.id, x.fam || '-' || lpad(x.n::text, 2, '0'), x.nombre, (x.n * 10)::int,
  x.fam IN ('F03','F04','F06','F07','F09','F12','F13','F16','F18'),
  x.fam IN ('F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F14','F18'),
  x.fam NOT IN ('F05','F14','F15','F16'),
  x.fam NOT IN ('F14','F15','F16'),
  x.fam NOT IN ('F11','F17'),
  x.fam IN ('F02','F05','F07','F09','F11','F12','F18')
    OR (x.fam IN ('F01','F10') AND (x.nombre ILIKE '%muestra%' OR x.nombre ILIKE 'Control%')),
  x.fam IN ('F03','F04','F05','F07','F08','F13','F14','F18'),
  x.fam IN ('F03','F04','F05','F07','F08','F09','F13','F14','F18'),
  x.fam IN ('F03','F04','F06','F07','F09','F12','F13','F18'),
  x.fam IN ('F03','F04','F06','F09','F12','F13'),
  x.fam IN ('F07','F17','F18')
    OR x.nombre IN ('Autorización de laboratorio','Liberación autorizada','Validación de resultados','Autorización de operaciones'),
  CASE
    WHEN x.fam = 'F02' AND x.nombre = 'Descarga a depósito' THEN 'descarga'
    WHEN x.fam = 'F12' AND x.nombre IN ('Carga por compartimentos','Expedición') THEN 'carga'
    WHEN x.fam = 'F06' THEN 'trasiego'
    WHEN x.fam = 'F14' THEN 'limpieza'
    WHEN x.fam = 'F01' AND x.nombre IN ('Descarga en tolva','Registro de kilos') THEN 'vendimia'
    WHEN x.fam = 'F13' AND x.nombre = 'Llenado' THEN 'embotellado'
    WHEN x.fam IN ('F07','F08') AND (x.nombre LIKE 'Adición%' OR x.nombre LIKE 'Corrección%') THEN 'producto'
    WHEN x.fam = 'F17' AND x.nombre = 'No conformidades' THEN 'incidencia'
    ELSE 'operacion'
  END
FROM x JOIN public.familias_operativas f ON f.codigo = x.fam
ON CONFLICT DO NOTHING;

UPDATE public.trabajos t SET operacion_catalogo_id = o.id
  FROM public.operaciones_catalogo o
 WHERE t.operacion_catalogo_id IS NULL
   AND ((t.tipo::text = 'carga' AND o.codigo = 'F12-06') OR (t.tipo::text = 'descarga' AND o.codigo = 'F02-09'));

CREATE OR REPLACE FUNCTION public.trabajo_operacion_por_defecto()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.operacion_catalogo_id IS NULL AND NEW.tipo::text IN ('carga','descarga') THEN
    SELECT id INTO NEW.operacion_catalogo_id FROM public.operaciones_catalogo
     WHERE codigo = CASE WHEN NEW.tipo::text = 'carga' THEN 'F12-06' ELSE 'F02-09' END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trabajo_operacion_por_defecto() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_trabajo_operacion_defecto BEFORE INSERT ON public.trabajos
  FOR EACH ROW EXECUTE FUNCTION public.trabajo_operacion_por_defecto();