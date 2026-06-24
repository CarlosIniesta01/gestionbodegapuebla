import { useActiveBodegaContext } from "@/lib/active-bodega-context";

export function useActiveBodega() {
  const ctx = useActiveBodegaContext();
  return {
    bodegaId: ctx.bodegaId,
    bodega: ctx.bodega,
    bodegas: ctx.bodegas,
    isLoading: ctx.isLoading,
    setActiveBodegaId: ctx.setActiveBodegaId,
    viewMode: ctx.viewMode,
    setViewMode: ctx.setViewMode,
    isGlobal: ctx.isGlobal,
  };
}
