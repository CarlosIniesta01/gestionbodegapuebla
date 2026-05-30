CREATE TABLE public.bodega_maps (
  bodega_id uuid PRIMARY KEY REFERENCES public.bodegas(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{"zonas": [], "depositos": []}'::jsonb,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bodega_maps_data_shape CHECK (
    jsonb_typeof(data) = 'object'
    AND jsonb_typeof(data -> 'zonas') = 'array'
    AND jsonb_typeof(data -> 'depositos') = 'array'
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bodega_maps TO authenticated;
GRANT ALL ON public.bodega_maps TO service_role;

ALTER TABLE public.bodega_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bodega maps read members"
ON public.bodega_maps
FOR SELECT
TO authenticated
USING (bodega_id IN (SELECT public.current_user_bodegas()));

CREATE POLICY "bodega maps insert admins"
ON public.bodega_maps
FOR INSERT
TO authenticated
WITH CHECK (public.is_bodega_admin(bodega_id));

CREATE POLICY "bodega maps update admins"
ON public.bodega_maps
FOR UPDATE
TO authenticated
USING (public.is_bodega_admin(bodega_id))
WITH CHECK (public.is_bodega_admin(bodega_id));

CREATE POLICY "bodega maps delete admins"
ON public.bodega_maps
FOR DELETE
TO authenticated
USING (public.is_bodega_admin(bodega_id));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_bodega_maps_updated_at
BEFORE UPDATE ON public.bodega_maps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.bodega_maps;