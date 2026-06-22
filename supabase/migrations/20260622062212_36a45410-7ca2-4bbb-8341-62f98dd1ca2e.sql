DROP VIEW IF EXISTS public.v_posicion_comercial;
CREATE VIEW public.v_posicion_comercial AS
WITH ex AS (
  SELECT bodega_id, producto_id,
         SUM(litros) AS litros_existencia,
         SUM(alcohol_absoluto) AS alcohol_absoluto
    FROM public.existencias_actuales
   GROUP BY bodega_id, producto_id
), cp AS (
  SELECT bodega_id, producto_id,
         SUM(litros_pendientes) AS compras_pendientes
    FROM public.contratos_compra
   WHERE estado IN ('pendiente','parcial')
   GROUP BY bodega_id, producto_id
), vp AS (
  SELECT bodega_id, producto_id,
         SUM(litros_pendientes) AS ventas_pendientes
    FROM public.contratos_venta
   WHERE estado IN ('pendiente','parcial')
   GROUP BY bodega_id, producto_id
), base AS (
  SELECT COALESCE(ex.bodega_id, cp.bodega_id, vp.bodega_id) AS bodega_id,
         COALESCE(ex.producto_id, cp.producto_id, vp.producto_id) AS producto_id,
         COALESCE(ex.litros_existencia, 0) AS litros_existencia,
         COALESCE(ex.alcohol_absoluto, 0) AS alcohol_absoluto,
         COALESCE(cp.compras_pendientes, 0) AS compras_pendientes,
         COALESCE(vp.ventas_pendientes, 0) AS ventas_pendientes
    FROM ex
    FULL JOIN cp ON cp.bodega_id = ex.bodega_id AND cp.producto_id = ex.producto_id
    FULL JOIN vp ON vp.bodega_id = COALESCE(ex.bodega_id, cp.bodega_id)
                 AND vp.producto_id = COALESCE(ex.producto_id, cp.producto_id)
)
SELECT b.bodega_id,
       b.producto_id,
       pc.codigo,
       pc.nombre AS producto_nombre,
       pc.campaña AS campana,
       pc.tipo,
       pc.color,
       pc.grado_referencia,
       b.litros_existencia,
       b.compras_pendientes,
       b.ventas_pendientes,
       (b.litros_existencia + b.compras_pendientes - b.ventas_pendientes) AS disponible_comercial,
       b.alcohol_absoluto
  FROM base b
  LEFT JOIN public.productos_comerciales pc ON pc.id = b.producto_id;

GRANT SELECT ON public.v_posicion_comercial TO authenticated;
GRANT SELECT ON public.v_posicion_comercial TO service_role;