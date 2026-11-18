import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCatalogoOperaciones } from "@/lib/api/operaciones-catalogo.functions";
import type { Familia, Operacion, CentroCfg } from "@/lib/operaciones-meta";

export function useCatalogoOperaciones(bodegaIds: string[]) {
  const fn = useServerFn(getCatalogoOperaciones);
  const ids = [...bodegaIds].sort();
  return useQuery({
    queryKey: ["catalogo-operaciones", ids],
    queryFn: async () => {
      const r = await fn({ data: { bodegaIds: ids } });
      return r as unknown as {
        familias: Familia[]; operaciones: Operacion[]; centro: CentroCfg[];
        permisos: Record<string, Record<string, boolean>>;
      };
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}
