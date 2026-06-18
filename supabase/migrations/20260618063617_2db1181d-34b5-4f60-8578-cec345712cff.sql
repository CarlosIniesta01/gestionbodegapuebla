ALTER VIEW public.existencias_por_producto SET (security_invoker = on);
-- Confirmar también la vista hermana por si quedó con el default antiguo.
ALTER VIEW public.existencias_actuales      SET (security_invoker = on);