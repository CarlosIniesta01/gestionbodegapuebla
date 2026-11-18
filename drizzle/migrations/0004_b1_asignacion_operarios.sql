ALTER TYPE public.participacion_estado ADD VALUE IF NOT EXISTS 'aceptado';
ALTER TYPE public.participacion_estado ADD VALUE IF NOT EXISTS 'retirado';

ALTER TABLE public.trabajo_trabajadores
  ADD COLUMN IF NOT EXISTS es_responsable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS respondido_at timestamptz,
  ADD COLUMN IF NOT EXISTS retirado_por uuid,
  ADD COLUMN IF NOT EXISTS retirado_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_retiro text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tt_trabajo_trabajador_activa ON public.trabajo_trabajadores (trabajo_id, trabajador_id) WHERE activa;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tt_responsable_activo ON public.trabajo_trabajadores (trabajo_id) WHERE activa AND es_responsable;

ALTER TABLE public.trabajos ADD COLUMN IF NOT EXISTS instrucciones text;

-- Avisos internos por usuario
CREATE TABLE public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bodega_id uuid NOT NULL REFERENCES public.bodegas(id) ON DELETE CASCADE,
  trabajo_id uuid REFERENCES public.trabajos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  cuerpo text,
  dedupe_key text NOT NULL UNIQUE,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notificaciones (user_id, leida, created_at DESC);
GRANT SELECT, UPDATE ON public.notificaciones TO authenticated;
GRANT ALL ON public.notificaciones TO service_role;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select_own ON public.notificaciones FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_update_own ON public.notificaciones FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._notificar(_user uuid, _bodega uuid, _trabajo uuid, _tipo text, _titulo text, _cuerpo text, _key text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificaciones (user_id, bodega_id, trabajo_id, tipo, titulo, cuerpo, dedupe_key)
  VALUES (_user, _bodega, _trabajo, _tipo, _titulo, _cuerpo, _key)
  ON CONFLICT (dedupe_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public._notificar(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

-- Reglas de asignación (servidor)
CREATE OR REPLACE FUNCTION public.tt_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gestor boolean := public.has_permission(NEW.bodega_id, 'tareas.asignar');
  v_trab_bodega uuid;
  v_trab_estado text;
BEGIN
  SELECT bodega_id, estado::text INTO v_trab_bodega, v_trab_estado FROM public.trabajos WHERE id = NEW.trabajo_id;
  IF v_trab_bodega IS NULL OR v_trab_bodega <> NEW.bodega_id THEN
    RAISE EXCEPTION 'La asignación debe pertenecer al centro del trabajo';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT v_gestor THEN RAISE EXCEPTION 'Sin permiso para asignar trabajos en este centro'; END IF;
    IF v_trab_estado IN ('cancelado','completado') THEN RAISE EXCEPTION 'No se puede asignar un trabajo cancelado o finalizado'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = NEW.trabajador_id AND m.bodega_id = NEW.bodega_id AND m.estado = 'activo') THEN
      RAISE EXCEPTION 'El operario no está autorizado en el centro del trabajo';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF NEW.trabajo_id <> OLD.trabajo_id OR NEW.trabajador_id <> OLD.trabajador_id OR NEW.bodega_id <> OLD.bodega_id THEN
    RAISE EXCEPTION 'No se puede cambiar el trabajo, el operario ni el centro de una asignación';
  END IF;
  IF OLD.activa = false AND NEW.activa = true AND NOT v_gestor THEN
    RAISE EXCEPTION 'Sin permiso para reactivar asignaciones';
  END IF;
  IF NOT v_gestor THEN
    IF OLD.trabajador_id <> auth.uid() THEN RAISE EXCEPTION 'Solo puedes responder a tus propias asignaciones'; END IF;
    IF NEW.es_responsable <> OLD.es_responsable OR NEW.activa <> OLD.activa
       OR NEW.retirado_por IS DISTINCT FROM OLD.retirado_por OR NEW.rol_en_trabajo IS DISTINCT FROM OLD.rol_en_trabajo THEN
      RAISE EXCEPTION 'Un operario no puede modificar la distribución del trabajo';
    END IF;
    IF NEW.estado_participacion::text = 'rechazado' AND OLD.estado_participacion::text <> 'rechazado'
       AND coalesce(trim(NEW.motivo_rechazo), '') = '' THEN
      RAISE EXCEPTION 'Indica el motivo del rechazo';
    END IF;
  END IF;
  IF NEW.activa = false AND NEW.es_responsable THEN NEW.es_responsable := false; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tt_guard ON public.trabajo_trabajadores;
CREATE TRIGGER trg_tt_guard BEFORE INSERT OR UPDATE ON public.trabajo_trabajadores FOR EACH ROW EXECUTE FUNCTION public.tt_guard();

-- Avisos por asignaciones
CREATE OR REPLACE FUNCTION public.tt_notificar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_titulo text; v_nombre text; v_dest uuid;
BEGIN
  SELECT titulo INTO v_titulo FROM public.trabajos WHERE id = NEW.trabajo_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.activa THEN
      PERFORM public._notificar(NEW.trabajador_id, NEW.bodega_id, NEW.trabajo_id, 'asignacion',
        'Nuevo trabajo asignado', v_titulo || CASE WHEN NEW.es_responsable THEN ' · Responsable de ejecución' ELSE '' END,
        'asig:' || NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.estado_participacion::text = 'rechazado' AND OLD.estado_participacion::text <> 'rechazado' THEN
    SELECT coalesce(nombre, email) INTO v_nombre FROM public.profiles WHERE user_id = NEW.trabajador_id;
    v_dest := coalesce(NEW.created_by, (SELECT created_by FROM public.trabajos WHERE id = NEW.trabajo_id));
    IF v_dest IS NOT NULL THEN
      PERFORM public._notificar(v_dest, NEW.bodega_id, NEW.trabajo_id, 'rechazo',
        'Asignación rechazada', coalesce(v_nombre,'Operario') || ' rechazó «' || v_titulo || '»: ' || coalesce(NEW.motivo_rechazo,''),
        'rech:' || NEW.id || ':' || coalesce(NEW.respondido_at, now())::text);
    END IF;
  END IF;
  IF OLD.activa AND NOT NEW.activa THEN
    PERFORM public._notificar(NEW.trabajador_id, NEW.bodega_id, NEW.trabajo_id, 'retirada',
      'Retirado de un trabajo', v_titulo || coalesce(' · ' || NEW.motivo_retiro, ''), 'ret:' || NEW.id || ':' || coalesce(NEW.retirado_at, now())::text);
  END IF;
  IF NOT OLD.activa AND NEW.activa THEN
    PERFORM public._notificar(NEW.trabajador_id, NEW.bodega_id, NEW.trabajo_id, 'asignacion',
      'Trabajo reasignado', v_titulo, 'reasig:' || NEW.id || ':' || now()::text);
  END IF;
  IF NEW.activa AND NEW.es_responsable AND NOT OLD.es_responsable THEN
    PERFORM public._notificar(NEW.trabajador_id, NEW.bodega_id, NEW.trabajo_id, 'responsable',
      'Eres responsable de ejecución', v_titulo, 'resp:' || NEW.id || ':' || now()::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tt_notificar ON public.trabajo_trabajadores;
CREATE TRIGGER trg_tt_notificar AFTER INSERT OR UPDATE ON public.trabajo_trabajadores FOR EACH ROW EXECUTE FUNCTION public.tt_notificar();

-- Avisos por cambio de fecha o instrucciones
CREATE OR REPLACE FUNCTION public.trabajo_notificar_cambios()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_campo text;
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN v_campo := 'fecha';
  ELSIF NEW.instrucciones IS DISTINCT FROM OLD.instrucciones THEN v_campo := 'instrucciones';
  ELSE RETURN NEW; END IF;
  FOR r IN SELECT trabajador_id FROM public.trabajo_trabajadores WHERE trabajo_id = NEW.id AND activa LOOP
    IF r.trabajador_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      PERFORM public._notificar(r.trabajador_id, NEW.bodega_id, NEW.id, 'cambio',
        CASE v_campo WHEN 'fecha' THEN 'Cambio de fecha prevista' ELSE 'Instrucciones actualizadas' END,
        NEW.titulo, 'cambio:' || NEW.id || ':' || r.trabajador_id || ':' || v_campo || ':' || md5(coalesce(NEW.scheduled_at::text,'') || coalesce(NEW.instrucciones,'')));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_trabajo_notificar_cambios ON public.trabajos;
CREATE TRIGGER trg_trabajo_notificar_cambios AFTER UPDATE ON public.trabajos FOR EACH ROW EXECUTE FUNCTION public.trabajo_notificar_cambios();

-- Programación (fecha, prioridad, instrucciones) por gestores del centro, auditada
CREATE OR REPLACE FUNCTION public.actualizar_programacion_trabajo(_trabajo uuid, _scheduled_at timestamptz, _prioridad text, _instrucciones text, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  SELECT * INTO t FROM public.trabajos WHERE id = _trabajo FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
  IF NOT public.has_permission(t.bodega_id, 'tareas.asignar') THEN RAISE EXCEPTION 'Sin permiso para programar trabajos en este centro'; END IF;
  IF t.estado::text <> 'pendiente' THEN RAISE EXCEPTION 'Solo se puede reprogramar antes de la ejecución'; END IF;
  UPDATE public.trabajos SET scheduled_at = _scheduled_at, prioridad = _prioridad::public.trabajo_prioridad,
    instrucciones = nullif(trim(_instrucciones), ''), updated_at = now() WHERE id = _trabajo;
  INSERT INTO public.trabajo_eventos (trabajo_id, user_id, tipo, contenido, meta)
  VALUES (_trabajo, auth.uid(), 'programacion', 'Programación modificada' || coalesce(': ' || nullif(trim(_motivo),''), ''),
    jsonb_build_object('anterior', jsonb_build_object('scheduled_at', t.scheduled_at, 'prioridad', t.prioridad, 'instrucciones', t.instrucciones),
                       'nuevo', jsonb_build_object('scheduled_at', _scheduled_at, 'prioridad', _prioridad, 'instrucciones', _instrucciones)));
  INSERT INTO public.auditoria (bodega_id, user_id, accion, tabla, registro_id, payload)
  VALUES (t.bodega_id, auth.uid(), 'TRABAJO_REPROGRAMADO', 'trabajos', _trabajo::text,
    jsonb_build_object('motivo', _motivo, 'anterior', jsonb_build_object('scheduled_at', t.scheduled_at, 'prioridad', t.prioridad, 'instrucciones', t.instrucciones),
                       'nuevo', jsonb_build_object('scheduled_at', _scheduled_at, 'prioridad', _prioridad, 'instrucciones', _instrucciones)));
END $$;
REVOKE ALL ON FUNCTION public.actualizar_programacion_trabajo(uuid,timestamptz,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_programacion_trabajo(uuid,timestamptz,text,text,text) TO authenticated;

-- RLS: gestión por permiso del centro; sin borrado físico
DROP POLICY IF EXISTS tt_insert_admin ON public.trabajo_trabajadores;
DROP POLICY IF EXISTS tt_update_admin_or_self ON public.trabajo_trabajadores;
DROP POLICY IF EXISTS tt_delete_admin ON public.trabajo_trabajadores;
CREATE POLICY tt_insert_gestor ON public.trabajo_trabajadores FOR INSERT TO authenticated
  WITH CHECK (bodega_id IN (SELECT public.current_user_bodegas()) AND public.has_permission(bodega_id, 'tareas.asignar'));
CREATE POLICY tt_update_gestor_or_self ON public.trabajo_trabajadores FOR UPDATE TO authenticated
  USING (public.has_permission(bodega_id, 'tareas.asignar') OR trabajador_id = auth.uid())
  WITH CHECK (public.has_permission(bodega_id, 'tareas.asignar') OR trabajador_id = auth.uid());