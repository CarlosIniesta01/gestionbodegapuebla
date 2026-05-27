import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity as ActivityIcon, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { listActividad } from "@/lib/api/trabajos.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { TIPO_META, type TrabajoTipo } from "@/lib/trabajo-meta";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/actividad")({
  head: () => ({ meta: [{ title: "Actividad · Vinea Control" }] }),
  component: Actividad,
});

const EVENT_LABEL: Record<string, string> = {
  creado: "creó",
  estado: "cambió estado a",
  comentario: "comentó",
};

function Actividad() {
  const { bodegaId, isLoading } = useActiveBodega();
  const qc = useQueryClient();
  const fn = useServerFn(listActividad);
  const q = useQuery({
    queryKey: ["actividad", bodegaId],
    queryFn: () => fn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });

  React.useEffect(() => {
    if (!bodegaId) return;
    const ch = supabase.channel(`actividad:${bodegaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajo_eventos" },
        () => qc.invalidateQueries({ queryKey: ["actividad"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bodegaId, qc]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  const eventos = q.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Actividad</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Línea de tiempo</h1>
      </div>

      {eventos.length === 0 ? (
        <div className="scada-panel p-10 text-center text-muted-foreground">
          <ActivityIcon className="size-10 mx-auto mb-3 opacity-50" />
          Sin actividad reciente.
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          {eventos.map((e: any, i: number) => {
            const tipoTrabajo = e.trabajos?.tipo as TrabajoTipo | undefined;
            const meta = tipoTrabajo ? TIPO_META[tipoTrabajo] : null;
            const Icon = meta?.icon;
            return (
              <motion.div key={e.id}
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
                className="relative pb-4">
                <div className="absolute -left-[18px] top-1 size-4 rounded-full border-2 border-background"
                  style={{ background: meta?.color ?? "var(--muted-foreground)" }} />
                <div className="scada-panel p-3">
                  <div className="flex items-start gap-2">
                    {Icon && meta && (
                      <div className="size-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `color-mix(in oklab, ${meta.color} 16%, transparent)` }}>
                        <Icon className="size-4" style={{ color: meta.color }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{EVENT_LABEL[e.tipo] ?? e.tipo}</span>{" "}
                        <span className="font-medium">{e.trabajos?.titulo ?? "trabajo"}</span>
                      </div>
                      {e.contenido && <div className="text-sm text-muted-foreground mt-0.5">{e.contenido}</div>}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1 font-mono">
                        {e.trabajos?.deposito_origen && <span>{e.trabajos.deposito_origen}</span>}
                        {e.trabajos?.deposito_origen && e.trabajos?.deposito_destino && <ArrowRight className="size-3" />}
                        {e.trabajos?.deposito_destino && <span>{e.trabajos.deposito_destino}</span>}
                        <span className="ml-auto">{new Date(e.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
