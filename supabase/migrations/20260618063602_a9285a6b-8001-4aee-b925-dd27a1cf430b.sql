-- 1) Vista agregada por producto (solo lectura; hereda RLS de movimientos).
CREATE OR REPLACE VIEW public.existencias_por_producto AS
SELECT
  bodega_id,
  producto_id,
  SUM(litros)                          AS litros,
  CASE WHEN SUM(litros) > 0
       THEN SUM(litros * COALESCE(grado,0)) / NULLIF(SUM(litros),0)
       ELSE 0
  END                                  AS grado_medio,
  SUM(litros * COALESCE(grado,0) / 100) AS alcohol_absoluto
FROM (
  SELECT bodega_id, producto_id, -litros AS litros, grado
    FROM public.movimientos
   WHERE deposito_origen_id IS NOT NULL
     AND estado_movimiento = 'activo'
     AND tipo IN ('salida','trasiego','mezcla','embotellado','correccion','ajuste')
  UNION ALL
  SELECT bodega_id, producto_id, litros, grado
    FROM public.movimientos
   WHERE deposito_destino_id IS NOT NULL
     AND estado_movimiento = 'activo'
     AND tipo IN ('entrada','trasiego','mezcla','correccion','ajuste')
) flujo
GROUP BY bodega_id, producto_id;

GRANT SELECT ON public.existencias_por_producto TO authenticated;
GRANT SELECT ON public.existencias_por_producto TO service_role;

-- 2) Columnas nulables para enlaces futuros.
ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS contrato_compra_id uuid,
  ADD COLUMN IF NOT EXISTS contrato_venta_id  uuid,
  ADD COLUMN IF NOT EXISTS elaboracion_id     uuid,
  ADD COLUMN IF NOT EXISTS lote_id            uuid,
  ADD COLUMN IF NOT EXISTS incidencia_id      uuid;

CREATE INDEX IF NOT EXISTS idx_mov_contrato_compra ON public.movimientos(contrato_compra_id) WHERE contrato_compra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_contrato_venta  ON public.movimientos(contrato_venta_id)  WHERE contrato_venta_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_elaboracion     ON public.movimientos(elaboracion_id)     WHERE elaboracion_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_lote            ON public.movimientos(lote_id)            WHERE lote_id            IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_incidencia      ON public.movimientos(incidencia_id)      WHERE incidencia_id      IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='movimientos_elaboracion_id_fkey') THEN
    ALTER TABLE public.movimientos
      ADD CONSTRAINT movimientos_elaboracion_id_fkey
      FOREIGN KEY (elaboracion_id) REFERENCES public.elaboraciones(id) ON DELETE SET NULL;
  END IF;
END $$;
