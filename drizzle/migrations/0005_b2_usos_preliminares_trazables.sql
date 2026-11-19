CREATE UNIQUE INDEX uq_b2_uso_registro ON public.trabajo_eventos (trabajo_id, (meta->>'registro_id')) WHERE tipo = 'b2_uso_preliminar';
CREATE OR REPLACE FUNCTION public.b2_guard_uso_preliminar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; u jsonb; linea jsonb; l record; factor numeric; cantidad numeric; anterior numeric; actual numeric; fecha date;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  IF OLD.tipo = 'b2_uso_preliminar' OR (TG_OP = 'UPDATE' AND NEW.tipo = 'b2_uso_preliminar') THEN RAISE EXCEPTION 'Los registros preliminares B2 conservan su historial y no se modifican ni eliminan'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF NEW.tipo <> 'b2_uso_preliminar' THEN RETURN NEW; END IF;
 SELECT * INTO t FROM public.trabajos WHERE id = NEW.trabajo_id FOR UPDATE;
 IF t.id IS NULL OR t.estado::text NOT IN ('pendiente','en_curso') OR t.datos->'multioperacion'->>'version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'La orden no admite registros preliminares B2'; END IF;
 IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND bodega_id=t.bodega_id AND estado='activo') OR NOT EXISTS (SELECT 1 FROM public.trabajo_trabajadores WHERE trabajo_id=t.id AND trabajador_id=auth.uid() AND bodega_id=t.bodega_id AND activa AND estado_participacion::text IN ('asignado','aceptado','en_proceso')) THEN RAISE EXCEPTION 'Solo el operario asignado puede registrar sus propios datos'; END IF;
 IF jsonb_typeof(NEW.meta->'usos') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.meta->'usos') NOT BETWEEN 1 AND 100 OR NEW.meta->>'registro_id' IS NULL THEN RAISE EXCEPTION 'Registro preliminar incompleto'; END IF;
 PERFORM (NEW.meta->>'registro_id')::uuid;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.meta->'usos') x GROUP BY x->>'linea_id', x->>'lote_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'No repitas el mismo lote en una línea'; END IF;
 FOR u IN SELECT value FROM jsonb_array_elements(NEW.meta->'usos') LOOP
  SELECT value INTO linea FROM jsonb_array_elements(t.datos->'multioperacion'->'productos') WHERE value->>'id'=u->>'linea_id';
  IF linea IS NULL THEN RAISE EXCEPTION 'Línea ajena a la orden'; END IF;
  IF EXISTS (SELECT 1 FROM public.trabajo_eventos e, LATERAL jsonb_array_elements(e.meta->'usos') x WHERE e.trabajo_id=t.id AND e.tipo='b2_uso_preliminar' AND x->>'linea_id'=u->>'linea_id' AND x->>'lote_id'=u->>'lote_id') THEN RAISE EXCEPTION 'Este lote ya está registrado para la línea'; END IF;
  SELECT * INTO l FROM public.producto_lotes WHERE id=(u->>'lote_id')::uuid FOR SHARE;
  IF l.id IS NULL OR l.bodega_id<>t.bodega_id OR l.producto_id::text IS DISTINCT FROM linea->>'producto_id' THEN RAISE EXCEPTION 'Lote ajeno al producto o centro'; END IF;
  IF l.estado::text <> 'disponible' THEN RAISE EXCEPTION 'Lote bloqueado, agotado o caducado'; END IF;
  fecha := (u->>'fecha_caducidad')::date;
  IF fecha IS NULL OR fecha < CURRENT_DATE OR (l.fecha_caducidad IS NOT NULL AND fecha<>l.fecha_caducidad) THEN RAISE EXCEPTION 'Verifica la caducidad del lote'; END IF;
  factor := CASE WHEN l.unidad=linea->>'unidad' THEN 1 WHEN (l.unidad='g' AND linea->>'unidad'='kg') OR (l.unidad='mL' AND linea->>'unidad'='L') THEN 1000 ELSE NULL END;
  cantidad := (u->>'cantidad_real')::numeric;
  IF factor IS NULL OR cantidad IS NULL OR cantidad<=0 OR cantidad::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Cantidad o unidad no válida'; END IF;
  SELECT coalesce(sum((x->>'cantidad_real')::numeric * CASE WHEN l.unidad=p->>'unidad' THEN 1 ELSE 1000 END),0) INTO anterior FROM public.trabajo_eventos e CROSS JOIN LATERAL jsonb_array_elements(e.meta->'usos') x CROSS JOIN LATERAL jsonb_array_elements(t.datos->'multioperacion'->'productos') p WHERE e.trabajo_id=t.id AND e.tipo='b2_uso_preliminar' AND x->>'lote_id'=l.id::text AND p->>'id'=x->>'linea_id';
  SELECT coalesce(sum((x->>'cantidad_real')::numeric * CASE WHEN l.unidad=p->>'unidad' THEN 1 ELSE 1000 END),0) INTO actual FROM jsonb_array_elements(NEW.meta->'usos') x CROSS JOIN LATERAL jsonb_array_elements(t.datos->'multioperacion'->'productos') p WHERE x->>'lote_id'=l.id::text AND p->>'id'=x->>'linea_id';
  IF anterior+actual>l.cantidad_disponible THEN RAISE EXCEPTION 'Cantidad real superior a la disponibilidad del lote'; END IF;
 END LOOP;
 NEW.meta := jsonb_build_object('version',1,'naturaleza','preliminar_sin_consumo','registro_id',NEW.meta->>'registro_id','usos',NEW.meta->'usos');
 NEW.contenido := 'Registro preliminar de lotes y cantidades reales; sin descuento de almacén';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.b2_guard_uso_preliminar() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_b2_guard_uso_preliminar BEFORE INSERT OR UPDATE OR DELETE ON public.trabajo_eventos FOR EACH ROW EXECUTE FUNCTION public.b2_guard_uso_preliminar();
CREATE OR REPLACE FUNCTION public.b2_audit_uso_preliminar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.tipo='b2_uso_preliminar' THEN
 INSERT INTO public.auditoria(bodega_id,user_id,accion,tabla,registro_id,payload) SELECT bodega_id,NEW.user_id,'B2_USO_PRELIMINAR','trabajo_eventos',NEW.id::text,NEW.meta FROM public.trabajos WHERE id=NEW.trabajo_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.b2_audit_uso_preliminar() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_b2_audit_uso_preliminar AFTER INSERT ON public.trabajo_eventos FOR EACH ROW EXECUTE FUNCTION public.b2_audit_uso_preliminar();