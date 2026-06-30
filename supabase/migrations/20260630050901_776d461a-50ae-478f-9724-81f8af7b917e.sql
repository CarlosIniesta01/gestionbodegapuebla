
-- 1) Ampliar can_rectify_movimientos para incluir enólogo (mantiene admin/responsable existentes)
CREATE OR REPLACE FUNCTION public.can_rectify_movimientos(_bodega uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.memberships m
      JOIN public.roles r ON r.id = m.role_id
     WHERE m.user_id = auth.uid()
       AND m.bodega_id = _bodega
       AND m.estado = 'activo'
       AND r.key IN ('admin','responsable','enologo')
  );
$$;

-- 2) movimiento_lineas: políticas UPDATE/DELETE restringidas
DROP POLICY IF EXISTS lineas_update_admin ON public.movimiento_lineas;
DROP POLICY IF EXISTS lineas_delete_admin ON public.movimiento_lineas;

CREATE POLICY lineas_update_admin
  ON public.movimiento_lineas
  FOR UPDATE
  TO authenticated
  USING (public.can_rectify_movimientos(bodega_id))
  WITH CHECK (public.can_rectify_movimientos(bodega_id));

CREATE POLICY lineas_delete_admin
  ON public.movimiento_lineas
  FOR DELETE
  TO authenticated
  USING (public.can_rectify_movimientos(bodega_id));

-- 3) calendario_eventos: re-aplicar políticas al rol authenticated
DROP POLICY IF EXISTS cal_evt_select ON public.calendario_eventos;
DROP POLICY IF EXISTS cal_evt_modify ON public.calendario_eventos;

CREATE POLICY cal_evt_select
  ON public.calendario_eventos
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.bodega_id = calendario_eventos.bodega_id
       AND m.user_id = auth.uid()
       AND m.estado = 'activo'
  ));

CREATE POLICY cal_evt_modify
  ON public.calendario_eventos
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.bodega_id = calendario_eventos.bodega_id
       AND m.user_id = auth.uid()
       AND m.estado = 'activo'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.bodega_id = calendario_eventos.bodega_id
       AND m.user_id = auth.uid()
       AND m.estado = 'activo'
  ));

-- 4) calendario_evento_trabajadores: re-aplicar políticas al rol authenticated
DROP POLICY IF EXISTS cal_evt_trab_select ON public.calendario_evento_trabajadores;
DROP POLICY IF EXISTS cal_evt_trab_modify ON public.calendario_evento_trabajadores;

CREATE POLICY cal_evt_trab_select
  ON public.calendario_evento_trabajadores
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.bodega_id = calendario_evento_trabajadores.bodega_id
         AND m.user_id = auth.uid()
         AND m.estado = 'activo'
    )
  );

CREATE POLICY cal_evt_trab_modify
  ON public.calendario_evento_trabajadores
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.bodega_id = calendario_evento_trabajadores.bodega_id
       AND m.user_id = auth.uid()
       AND m.estado = 'activo'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.bodega_id = calendario_evento_trabajadores.bodega_id
       AND m.user_id = auth.uid()
       AND m.estado = 'activo'
  ));
