import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, FlaskConical } from "lucide-react";
import { PreparacionesDialog } from "@/components/PreparacionesDialog";

import { TRABAJO_TIPOS, type TrabajoTipo } from "@/lib/trabajo-meta";
import { listTrabajos } from "@/lib/api/trabajos.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { TrabajoFormDialog } from "@/components/TrabajoFormDialog";
import { EmbotelladoDialog } from "@/components/embotellado/EmbotelladoDialog";
import { TrabajoCard } from "@/components/TrabajoCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/trabajos")({
  head: () => ({ meta: [{ title: "Trabajos · Vinea Control" }] }),
  component: Trabajos,
});

function Trabajos() {
  const { bodegaId, isLoading } = useActiveBodega();
  const [open, setOpen] = React.useState(false);
  const [embOpen, setEmbOpen] = React.useState(false);
  const [prepOpen, setPrepOpen] = React.useState(false);
  const [defaultTipo, setDefaultTipo] = React.useState<TrabajoTipo>("trasiego");
  const [filtroTipo, setFiltroTipo] = React.useState<"all" | TrabajoTipo>("all");

  const fn = useServerFn(listTrabajos);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["trabajos", bodegaId, filtroTipo],
    queryFn: () => fn({ data: {
      bodegaId: bodegaId!,
      tipo: filtroTipo === "all" ? undefined : filtroTipo,
    } }),
    enabled: !!bodegaId,
  });

  // Realtime
  React.useEffect(() => {
    if (!bodegaId) return;
    const ch = supabase.channel(`trabajos:${bodegaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trabajos", filter: `bodega_id=eq.${bodegaId}` },
        () => qc.invalidateQueries({ queryKey: ["trabajos"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bodegaId, qc]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  if (!bodegaId) return <div className="p-6 text-muted-foreground">No tienes acceso a ninguna bodega.</div>;

  const launch = (tipo: TrabajoTipo) => {
    if (tipo === "embotellado") { setEmbOpen(true); return; }
    setDefaultTipo(tipo); setOpen(true);
  };
  const trabajos = q.data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Trabajos</div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Registrar y consultar</h1>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Nuevo</Button>
      </div>

      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Acceso rápido</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3 mb-6">
        {TRABAJO_TIPOS.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.button key={t.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}
              onClick={() => launch(t.id)}
              className="scada-panel p-3 flex flex-col items-center gap-2 transition-colors hover:border-accent/60">
              <div className="size-10 rounded-xl flex items-center justify-center"
                style={{ background: `color-mix(in oklab, ${t.color} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${t.color} 40%, transparent)` }}>
                <Icon className="size-5" style={{ color: t.color }} />
              </div>
              <div className="text-[11px] font-medium text-center leading-tight">{t.label}</div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <Tabs value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {TRABAJO_TIPOS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>

      {q.isLoading ? (
        <div className="text-muted-foreground p-6">Cargando…</div>
      ) : trabajos.length === 0 ? (
        <div className="scada-panel p-10 text-center text-muted-foreground">
          No hay trabajos registrados. Pulsa un tipo arriba para crear el primero.
        </div>
      ) : (
        <div className="space-y-3">
          {trabajos.map((t: any) => <TrabajoCard key={t.id} t={t} />)}
        </div>
      )}

      {bodegaId && (
        <>
          <TrabajoFormDialog open={open} onOpenChange={setOpen} bodegaId={bodegaId} defaultTipo={defaultTipo} />
          <EmbotelladoDialog open={embOpen} onOpenChange={setEmbOpen} bodegaId={bodegaId} />
        </>
      )}
    </div>
  );
}
