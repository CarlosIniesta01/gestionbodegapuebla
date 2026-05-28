DROP POLICY IF EXISTS "eventos delete author" ON public.trabajo_eventos;

CREATE POLICY "eventos delete author or admin"
ON public.trabajo_eventos
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.trabajos t
    WHERE t.id = trabajo_eventos.trabajo_id
      AND public.is_bodega_admin(t.bodega_id)
  )
);