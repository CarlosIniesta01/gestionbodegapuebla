import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrabajos } from "@/lib/api/trabajos.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { TrabajoCard } from "@/components/TrabajoCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const GROUPS = [
  { id: "en_curso", label: "En curso", estados: ["en_curso"] as const },
  { id: "pendiente", label: "Pendientes", estados: ["pendiente"] as const },
  { id: "completado", label: "Finalizados", estados: ["completado", "cancelado"] as const },
] as const;

export function BodegaHistorial() {
  const { bodegaId } = useActiveBodega();
  const fn = useServerFn(listTrabajos);
  const q = useQuery({
    queryKey: ["trabajos", bodegaId, "historial"],
    queryFn: () => fn({ data: { bodegaId: bodegaId!, limit: 200 } }),
    enabled: !!bodegaId,
    refetchInterval: 10000,
  });
  const all: any[] = q.data ?? [];

  return (
    <Tabs defaultValue="en_curso" className="space-y-3">
      <TabsList>
        {GROUPS.map((g) => {
          const n = all.filter((t) => g.estados.includes(t.estado)).length;
          return (
            <TabsTrigger key={g.id} value={g.id}>
              {g.label} <span className="ml-1.5 text-[10px] opacity-70">({n})</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {GROUPS.map((g) => {
        const items = all.filter((t) => g.estados.includes(t.estado));
        return (
          <TabsContent key={g.id} value={g.id}>
            {q.isLoading ? (
              <div className="text-muted-foreground p-6">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="scada-panel p-10 text-center text-muted-foreground">
                No hay trabajos en este estado.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((t) => <TrabajoCard key={t.id} t={t} />)}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
