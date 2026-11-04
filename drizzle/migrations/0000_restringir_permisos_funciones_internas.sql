-- 1) Funciones internas (triggers y uso interno): nadie puede llamarlas directamente
REVOKE EXECUTE ON FUNCTION public._calendario_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aplicar_consumo_lote() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_movimiento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_producto_generic() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trabajo_trabajadores() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bloquear_orden_cerrada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_contratos_mov() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_contrato_movimiento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_contrato_compra(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_contrato_venta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.marcar_lotes_caducados() FROM PUBLIC, anon, authenticated;

-- 2) Funciones que la app sí llama (ayudantes de permisos y RPC de órdenes):
--    se mantiene el acceso a usuarios registrados, se elimina el acceso anónimo
REVOKE EXECUTE ON FUNCTION public.can_rectify_movimientos(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_bodega_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_bodegas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_bodegas(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirmar_orden_logistica(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rectificar_orden_logistica(uuid, text, text, jsonb) FROM PUBLIC, anon;