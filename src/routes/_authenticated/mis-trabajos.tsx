import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Star, ThumbsUp, ThumbsDown, MapPin, Clock } from "lucide-react";
import { listMisTrabajos, responderAsignacion } from "@/lib/api/trabajadores.functions";
import { ASIG_ESTADO_LABEL, TRABAJO_ESTADO_LABEL, filtrarMisTrabajos, type FiltroMis } from "@/lib/asignaciones";
import { TIPO_META, PRIORIDAD_LABEL } from "@/lib/trabajo-meta";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PlanificacionResumen } from "@/components/trabajos/PlanificacionResumen";

export const Route = createFileRoute("/_authenticated/mis-trabajos")({
  head: () => ({ meta: [
    { title: "Mis trabajos · Vinea Control" },
    { name: "description", content: "Órdenes de trabajo asignadas al operario en todos sus centros." },
    { property: "og:title", content: "Mis trabajos · Vinea Control" },
    { property: "og:description", content: "Órdenes de trabajo asignadas al operario." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: z.object({ t: z.string().uuid().optional() }),
  component: MisTrabajos,
});

const FILTROS: { id: FiltroMis; label: string }[] = [
  { id: "hoy", label: "Hoy" }, { id: "proximos", label: "Próximos" }, { id: "pendientes", label: "Pendientes de respuesta" },
  { id: "aceptados", label: "Aceptados" }, { id: "historial", label: "Historial" },
];

function MisTrabajos() {
  const { t: foco } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fn = useServerFn(listMisTrabajos);
  const resp = useServerFn(responderAsignacion);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mis-trabajos"], queryFn: () => fn() });
  const [filtro, setFiltro] = React.useState<FiltroMis>("pendientes");
  const [rech, setRech] = React.useState<string | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const items = (q.data ?? []) as any[];
  const lista = foco ? items.filter((i) => i.trabajo_id === foco) : filtrarMisTrabajos(items, filtro);

  async function responder(id: string, aceptar: boolean) {
    try {
      await resp({ data: { id, aceptar, motivo: aceptar ? undefined : motivo } });
      toast.success(aceptar ? "Asignación aceptada" : "Asignación rechazada");
      setRech(null); setMotivo("");
      qc.invalidateQueries({ queryKey: ["mis-trabajos"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Operario</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Mis trabajos</h1>
      </div>
      {foco ? (
        <Button variant="outline" size="sm" className="mb-3" onClick={() => navigate({ search: {} })}>Ver todos</Button>
      ) : (
        <div className="overflow-x-auto mb-3">
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroMis)}>
            <TabsList>{FILTROS.map((f) => <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>)}</TabsList>
          </Tabs>
        </div>
      )}
      {q.isLoading ? <div className="text-muted-foreground p-6">Cargando…</div>
      : lista.length === 0 ? <div className="scada-panel p-8 text-center text-muted-foreground">No hay trabajos en esta vista.</div>
      : (
        <div className="space-y-3">
          {lista.map((a) => {
            const t = a.trabajo; const meta = TIPO_META[t.tipo as keyof typeof TIPO_META] ?? TIPO_META.observacion;
            const otros = t.asignaciones.filter((x: any) => x.activa && x.trabajador_id !== a.trabajador_id);
            const responsable = t.asignaciones.find((x: any) => x.activa && x.es_responsable);
            const d = t.datos ?? {};
            return (
              <article key={a.id} className="scada-panel p-4 space-y-2" aria-label={t.titulo}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{t.titulo}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.familia ? `${t.familia.nombre} · ` : ""}{t.operacion ? `${t.operacion.codigo} ${t.operacion.nombre}` : meta.label} · #{t.id.slice(0, 8)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline">{ASIG_ESTADO_LABEL[a.estado_participacion] ?? a.estado_participacion}</Badge>
                    <span className="text-[10px] text-muted-foreground">Trabajo: {TRABAJO_ESTADO_LABEL[t.estado] ?? t.estado}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="size-3" />{t.centro_nombre}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" />{t.scheduled_at ? new Date(t.scheduled_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin fecha"}</span>
                  <span>Prioridad: {PRIORIDAD_LABEL[t.prioridad]?.label ?? t.prioridad}</span>
                  {(t.deposito_origen || t.deposito_destino) && <span className="font-mono">{[t.deposito_origen, t.deposito_destino].filter(Boolean).join(" → ")}</span>}
                  {(d.producto || d.lote) && <span>{[d.producto, d.lote].filter(Boolean).join(" · ")}</span>}
                  {(d.litros || d.litros_previstos) && <span>{d.litros ?? d.litros_previstos} L previstos</span>}
                </div>
                {a.es_responsable
                  ? <div className="text-xs flex items-center gap-1 text-primary"><Star className="size-3" />Eres el responsable de ejecución</div>
                  : responsable && <div className="text-xs text-muted-foreground">Responsable: {responsable.nombre}</div>}
                {otros.length > 0 && <div className="text-xs text-muted-foreground">Participantes: {otros.map((o: any) => o.nombre).join(", ")}</div>}
                {t.instrucciones && <div className="text-sm rounded-md bg-muted p-2 whitespace-pre-wrap"><b className="text-xs uppercase tracking-wider">Instrucciones</b><br />{t.instrucciones}</div>}
                <PlanificacionResumen datos={t.datos} />
                {t.descripcion && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{t.descripcion}</div>}
                {a.motivo_rechazo && <div className="text-xs text-destructive">Motivo de rechazo: {a.motivo_rechazo}</div>}
                {a.activa && a.estado_participacion === "asignado" && t.estado === "pendiente" && (
                  rech === a.id ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input placeholder="Motivo del rechazo *" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                      <Button variant="destructive" disabled={!motivo.trim()} onClick={() => responder(a.id, false)}>Confirmar rechazo</Button>
                      <Button variant="ghost" onClick={() => setRech(null)}>Volver</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button className="flex-1 sm:flex-none" onClick={() => responder(a.id, true)}><ThumbsUp className="size-4 mr-1" />Aceptar</Button>
                      <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { setRech(a.id); setMotivo(""); }}><ThumbsDown className="size-4 mr-1" />Rechazar</Button>
                    </div>
                  )
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
