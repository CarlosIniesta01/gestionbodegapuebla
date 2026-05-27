import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ListTodo, Clock, AlertCircle } from "lucide-react";

import { listTrabajos } from "@/lib/api/trabajos.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { TrabajoCard } from "@/components/TrabajoCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pendientes")({
  head: () => ({ meta: [{ title: "Pendientes · Vinea Control" }] }),
  component: Pendientes,
});

function Pendientes() {
  const { bodegaId, isLoading } = useActiveBodega();
  const qc = useQueryClient();
  const fn = useServerFn(listTrabajos);
  const q = useQuery({
    queryKey: ["trabajos", bodegaId, "pendientes"],
    queryFn: () => fn({ data: { bodegaId: bodegaId!, estado: ["pendiente", "en_curso"] } }),
    enabled: !!bodegaId,
  });

  React.useEffect(() => {
    if (!bodegaId) return;
    const ch = supabase.channel(`pendientes:${bodegaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos", filter: `bodega_id=eq.${bodegaId}` },
        () => qc.invalidateQueries({ queryKey: ["trabajos"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bodegaId, qc]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  const trabajos = q.data ?? [];
  const enCurso = trabajos.filter((t: any) => t.estado === "en_curso");
  const pendientes = trabajos.filter((t: any) => t.estado === "pendiente");
  const urgentes = trabajos.filter((t: any) => t.prioridad === "urgente" || t.prioridad === "alta");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Pendientes</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Cola de trabajo</h1>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
        <Stat icon={Clock} label="En curso" value={enCurso.length} color="var(--state-fermentacion)" />
        <Stat icon={ListTodo} label="Pendientes" value={pendientes.length} color="var(--state-trasiego)" />
        <Stat icon={AlertCircle} label="Prioritarios" value={urgentes.length} color="var(--state-incidencia)" />
      </div>

      {enCurso.length > 0 && (
        <Section title="En curso">
          {enCurso.map((t: any) => <TrabajoCard key={t.id} t={t} />)}
        </Section>
      )}
      {pendientes.length > 0 && (
        <Section title="Pendientes">
          {pendientes.map((t: any) => <TrabajoCard key={t.id} t={t} />)}
        </Section>
      )}
      {trabajos.length === 0 && !q.isLoading && (
        <div className="scada-panel p-10 text-center text-muted-foreground">
          <ListTodo className="size-10 mx-auto mb-3 opacity-50" />
          No hay trabajos pendientes.
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="scada-panel p-3 md:p-4 flex items-center gap-3">
      <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 40%, transparent)` }}>
        <Icon className="size-5" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-display font-semibold tracking-tight">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
