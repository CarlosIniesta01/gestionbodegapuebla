CREATE TABLE public.invitaciones_trabajadores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bodega_id uuid NOT NULL REFERENCES public.bodegas(id),
 role_id uuid NOT NULL REFERENCES public.roles(id),
 email text NOT NULL CHECK (email = lower(btrim(email))),
 user_id uuid,
 estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','activada')),
 invited_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 activated_at timestamptz,
 sent_at timestamptz,
 send_error text,
 UNIQUE(bodega_id,email)
);
GRANT SELECT ON public.invitaciones_trabajadores TO authenticated;
GRANT ALL ON public.invitaciones_trabajadores TO service_role;
ALTER TABLE public.invitaciones_trabajadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitaciones_admin_read ON public.invitaciones_trabajadores FOR SELECT TO authenticated USING (public.is_bodega_admin(bodega_id));
CREATE OR REPLACE FUNCTION public.registrar_invitacion_trabajador(_bodega uuid,_rol uuid,_email text,_user uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_email text := lower(btrim(_email));
BEGIN
 IF NOT public.is_bodega_admin(_bodega) THEN RAISE EXCEPTION 'Solo un administrador del centro puede invitar'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.roles WHERE id=_rol AND bodega_id=_bodega AND activo) THEN RAISE EXCEPTION 'Rol no disponible en este centro'; END IF;
 IF _user IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_user AND lower(email)=v_email) THEN RAISE EXCEPTION 'Cuenta y correo no coinciden'; END IF;
 INSERT INTO public.invitaciones_trabajadores(bodega_id,role_id,email,user_id,invited_by) VALUES(_bodega,_rol,v_email,_user,auth.uid()) ON CONFLICT(bodega_id,email) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.invitaciones_trabajadores WHERE bodega_id=_bodega AND email=v_email; END IF;
 INSERT INTO public.auditoria(bodega_id,user_id,accion,tabla,registro_id,payload) VALUES(_bodega,auth.uid(),'invitacion_registrada','invitaciones_trabajadores',v_id::text,jsonb_build_object('role_id',_rol));
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.registrar_invitacion_trabajador(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_invitacion_trabajador(uuid,uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.activar_invitaciones_trabajador() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_email text; v_count integer := 0; v_inv public.invitaciones_trabajadores%ROWTYPE;
BEGIN
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL AND last_sign_in_at IS NOT NULL;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Debes autenticarte y verificar tu correo'; END IF;
 FOR v_inv IN SELECT * FROM public.invitaciones_trabajadores WHERE email=v_email AND estado='pendiente' AND (user_id IS NULL OR user_id=auth.uid()) FOR UPDATE LOOP
  IF NOT EXISTS(SELECT 1 FROM public.roles WHERE id=v_inv.role_id AND bodega_id=v_inv.bodega_id AND activo) THEN CONTINUE; END IF;
  INSERT INTO public.memberships(user_id,bodega_id,role_id,estado) VALUES(auth.uid(),v_inv.bodega_id,v_inv.role_id,'activo') ON CONFLICT(user_id,bodega_id) DO NOTHING;
  IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND bodega_id=v_inv.bodega_id AND estado='activo') THEN
   UPDATE public.invitaciones_trabajadores SET estado='activada',user_id=auth.uid(),activated_at=now() WHERE id=v_inv.id;
   INSERT INTO public.auditoria(bodega_id,user_id,accion,tabla,registro_id,payload) VALUES(v_inv.bodega_id,auth.uid(),'invitacion_activada','invitaciones_trabajadores',v_inv.id::text,jsonb_build_object('role_id',v_inv.role_id));
   v_count := v_count+1;
  END IF;
 END LOOP;
 RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.activar_invitaciones_trabajador() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activar_invitaciones_trabajador() TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_membership_authentication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.roles WHERE id=NEW.role_id AND bodega_id=NEW.bodega_id AND activo) THEN RAISE EXCEPTION 'Rol no disponible en este centro'; END IF;
 IF NEW.estado='activo' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.user_id AND email_confirmed_at IS NOT NULL AND last_sign_in_at IS NOT NULL) THEN RAISE EXCEPTION 'El trabajador debe confirmar su correo e iniciar sesión antes de activar el acceso'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_membership_authentication() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER membership_authentication_guard BEFORE INSERT OR UPDATE OF estado,role_id,bodega_id,user_id ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.guard_membership_authentication();