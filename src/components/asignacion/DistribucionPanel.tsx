import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { listDistribucion } from "@/lib/api/trabajadores.functions";
import { ASIG_ESTADO_LABEL, categoriaDistribucion, type CategoriaDistribucion } from "@/lib/asignaciones";
import { PRIORIDAD_LABEL } from "@/lib/trabajo-meta";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { TrabajoDetailDialog } from "@/components/trabajos/TrabajoDetailDialog";
import { Input } from "@/components/ui/input";

const CAT: Record<CategoriaDistribucion, string> = {
  sin_asignar: "Sin asignar", pendiente_aceptacion: "Pendiente de aceptación", con_rechazo: "Con rechazos",
  incompleta: "Asignación incompleta", asignado: "Asignado",
};
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Supervisión de la distribución: un trabajo, varias asignaciones. */
export function DistribucionPanel() {
  const { bodegas, bodegaId, isGlobal } = useActiveBodega();
  const fn = useServerFn(listDistribucion);
  const ids = isGlobal ? bodegas.map((b) => b.bodega_id) : bodegaId ? [bodegaId] : [];
  const q = useQuery({ queryKey: ["distribucion", ids.join(",")], queryFn: () => fn({ data: { bodegaIds: ids } }), enabled: ids.length > 0 });
  const [f, setF] = React.useState({ centro: "", fecha: "", familia: "", operacion: "", operario: "", prioridad: "", cat: "", estadoAsig: "" });
  const [abierto, setAbierto] = React.useState<any>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  if (q.data && !q.data.permitido) return <div className="scada-panel p-6 text-sm text-muted-foreground">No tienes permiso para distribuir trabajos en este centro.</div>;
  const ts = (q.data?.trabajos ?? []) as any[];
  const uniq = (xs: [string, string][]) => Array.from(new Map(xs).entries());
  const familias = uniq(ts.filter((t) => t.familia).map((t) => [t.familia.id, t.familia.nombre]));
  const operaciones = uniq(ts.filter((t) => t.operacion).map((t) => [t.operacion.codigo, `${t.operacion.codigo} ${t.operacion.nombre}`]));
  const operarios = uniq(ts.flatMap((t) => t.asignaciones.filter((a: any) => a.activa).map((a: any) => [a.trabajador_id, a.nombre] as [string, string])));
  const lista = ts.filter((t) => {
    const act = t.asignaciones.filter((a: any) => a.activa);
    return (!f.centro || t.bodega_id === f.centro)
      && (!f.fecha || t.scheduled_at?.slice(0, 10) === f.fecha)
      && (!f.familia || t.familia?.id === f.familia)
      && (!f.operacion || t.operacion?.codigo === f.operacion)
      && (!f.operario || act.some((a: any) => a.trabajador_id === f.operario))
      && (!f.prioridad || t.prioridad === f.prioridad)
      && (!f.cat || categoriaDistribucion(t.asignaciones) === f.cat)
      && (!f.estadoAsig || act.some((a: any) => a.estado_participacion === f.estadoAsig));
  });
  const cuenta = (c: CategoriaDistribucion) => ts.filter((t) => categoriaDistribucion(t.asignaciones) === c).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(Object.keys(CAT) as CategoriaDistribucion[]).map((c) => (
          <button key={c} onClick={() => setF((s) => ({ ...s, cat: s.cat === c ? "" : c }))}
            className={`scada-panel p-2 text-left ${f.cat === c ? "border-primary" : ""}`}>
            <div className="text-xl font-semibold">{cuenta(c)}</div><div className="text-[11px] text-muted-foreground">{CAT[c]}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {isGlobal && <select aria-label="Centro" className={sel} value={f.centro} onChange={set("centro")}><option value="">Todos los centros</option>{bodegas.map((b) => <option key={b.bodega_id} value={b.bodega_id}>{b.bodega.nombre}</option>)}</select>}
        <Input type="date" aria-label="Fecha" value={f.fecha} onChange={set("fecha")} />
        <select aria-label="Familia" className={sel} value={f.familia} onChange={set("familia")}><option value="">Familia</option>{familias.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Operación" className={sel} value={f.operacion} onChange={set("operacion")}><option value="">Operación</option>{operaciones.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Operario" className={sel} value={f.operario} onChange={set("operario")}><option value="">Operario</option>{operarios.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Prioridad" className={sel} value={f.prioridad} onChange={set("prioridad")}><option value="">Prioridad</option>{Object.entries(PRIORIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select aria-label="Estado de asignación" className={sel} value={f.estadoAsig} onChange={set("estadoAsig")}><option value="">Estado asignación</option>{["asignado", "aceptado", "rechazado", "ausente"].map((k) => <option key={k} value={k}>{ASIG_ESTADO_LABEL[k]}</option>)}</select>
      </div>
      {q.isLoading ? <div className="p-6 text-muted-foreground">Cargando…</div>
      : lista.length === 0 ? <div className="scada-panel p-8 text-center text-muted-foreground">No hay trabajos con estos filtros.</div>
      : (
        <div className="space-y-2">
          {lista.map((t) => {
            const cat = categoriaDistribucion(t.asignaciones);
            const act = t.asignaciones.filter((a: any) => a.activa);
            return (
              <button key={t.id} onClick={() => setAbierto(t)} className="scada-panel p-3 w-full text-left hover:border-accent/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.titulo}</div>
                    <div className="text-[11px] text-muted-foreground">{t.operacion ? `${t.operacion.codigo} · ` : ""}{t.scheduled_at ? new Date(t.scheduled_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin fecha"} · {PRIORIDAD_LABEL[t.prioridad]?.label}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border">{CAT[cat]}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">{t.centro_nombre}</span>
                  </div>
                </div>
                {act.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    {act.map((a: any) => (
                      <span key={a.id} className="px-1.5 py-0.5 rounded bg-muted flex items-center gap-1">
                        {a.es_responsable && <Star className="size-3" />}{a.nombre} · {ASIG_ESTADO_LABEL[a.estado_participacion]}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      {abierto && <TrabajoDetailDialog open onOpenChange={(v) => { if (!v) { setAbierto(null); q.refetch(); } }} trabajoId={abierto.id} trabajoTitulo={abierto.titulo} bodegaId={abierto.bodega_id} />}
    </div>
  );
}
