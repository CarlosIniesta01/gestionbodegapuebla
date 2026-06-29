import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Filter,
  AlertTriangle, RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { CAL_TIPO_META, CAL_ESTADO_META, CAL_TIPOS, CAL_ESTADOS, type CalTipo, type CalEstado } from "@/lib/calendario-meta";
import { listEventos, setEventoEstado, deleteEvento } from "@/lib/api/calendario.functions";
import { EventoFormDialog } from "@/components/calendario/EventoFormDialog";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendario · Vinea Control" }] }),
  component: CalendarioPage,
});

type Vista = "mes" | "semana" | "dia" | "agenda";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d: Date) {
  const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x;
}
function endOfWeek(d: Date) { const x = startOfWeek(d); x.setDate(x.getDate() + 7); return x; }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }
function endOfMonth(d: Date) { const x = startOfMonth(d); x.setMonth(x.getMonth() + 1); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function fmtHora(d: Date) { return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
function fmtFecha(d: Date) { return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" }); }

function CalendarioPage() {
  const { bodegaId, isGlobal, bodega } = useActiveBodega();
  const [vista, setVista] = React.useState<Vista>("semana");
  const [cursor, setCursor] = React.useState<Date>(new Date());
  const [openForm, setOpenForm] = React.useState(false);
  const [editando, setEditando] = React.useState<any | null>(null);
  const [filtros, setFiltros] = React.useState<{ tipos: CalTipo[]; estados: CalEstado[] }>({ tipos: [], estados: [] });

  const range = React.useMemo(() => {
    if (vista === "dia") return { from: startOfDay(cursor), to: endOfDay(cursor) };
    if (vista === "semana") return { from: startOfWeek(cursor), to: endOfWeek(cursor) };
    if (vista === "mes") {
      const from = startOfWeek(startOfMonth(cursor));
      const to = endOfWeek(endOfMonth(cursor));
      return { from, to };
    }
    return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 30) };
  }, [vista, cursor]);

  const fn = useServerFn(listEventos);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["calendario", bodegaId ?? "global", vista, range.from.toISOString(), range.to.toISOString(), filtros],
    queryFn: () => fn({ data: {
      bodegaId: bodegaId ?? null,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      tipos: filtros.tipos.length ? filtros.tipos : undefined,
      estados: filtros.estados.length ? filtros.estados : undefined,
    } }),
  });

  const eventos = q.data ?? [];

  const fnEstado = useServerFn(setEventoEstado);
  const fnDelete = useServerFn(deleteEvento);

  async function cambiarEstado(id: string, estado: CalEstado) {
    try { await fnEstado({ data: { id, estado } }); toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["calendario"] }); }
    catch (e: any) { toast.error(e.message); }
  }
  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    try { await fnDelete({ data: { id } }); toast.success("Evento eliminado"); qc.invalidateQueries({ queryKey: ["calendario"] }); }
    catch (e: any) { toast.error(e.message); }
  }

  function navegar(dir: -1 | 1) {
    const x = new Date(cursor);
    if (vista === "dia") x.setDate(x.getDate() + dir);
    else if (vista === "semana") x.setDate(x.getDate() + 7 * dir);
    else if (vista === "mes") x.setMonth(x.getMonth() + dir);
    else x.setDate(x.getDate() + 14 * dir);
    setCursor(x);
  }

  const tituloRango = React.useMemo(() => {
    if (vista === "dia") return cursor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (vista === "semana") {
      const a = startOfWeek(cursor), b = addDays(a, 6);
      return `${a.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} – ${b.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (vista === "mes") return cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return `Próximos 30 días`;
  }, [vista, cursor]);

  return (
    <div className="min-h-screen p-3 sm:p-5 space-y-3 sm:space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <CalendarIcon className="size-5 sm:size-6" /> Calendario operativo
          </h1>
          <p className="text-sm text-muted-foreground">
            {isGlobal ? "Visión global · todos los centros" : `Centro: ${bodega?.nombre ?? "—"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Hoy</Button>
          <div className="flex items-center border border-border rounded-md">
            <button className="p-1.5 hover:bg-muted" onClick={() => navegar(-1)}><ChevronLeft className="size-4" /></button>
            <div className="px-3 text-sm font-medium min-w-[180px] text-center">{tituloRango}</div>
            <button className="p-1.5 hover:bg-muted" onClick={() => navegar(1)}><ChevronRight className="size-4" /></button>
          </div>
          <Select value={vista} onValueChange={(v) => setVista(v as Vista)}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Día</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mes</SelectItem>
              <SelectItem value="agenda">Agenda</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCcw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
          {bodegaId && (
            <Button size="sm" onClick={() => { setEditando(null); setOpenForm(true); }}>
              <Plus className="size-4 mr-1" /> Nuevo evento
            </Button>
          )}
        </div>
      </header>

      <FiltrosBar filtros={filtros} setFiltros={setFiltros} />

      {!bodegaId && !isGlobal && (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          Selecciona un centro para ver y crear eventos.
        </div>
      )}

      <div className="border border-border rounded-md bg-card overflow-hidden">
        {vista === "mes" && <VistaMes from={range.from} cursor={cursor} eventos={eventos} onOpen={(ev) => { setEditando(ev); setOpenForm(true); }} onNuevo={(date) => { setEditando(null); setOpenForm(true); }} />}
        {vista === "semana" && <VistaSemana from={range.from} eventos={eventos} onOpen={(ev) => { setEditando(ev); setOpenForm(true); }} />}
        {vista === "dia" && <VistaDia day={cursor} eventos={eventos} onOpen={(ev) => { setEditando(ev); setOpenForm(true); }} />}
        {vista === "agenda" && <VistaAgenda eventos={eventos} onOpen={(ev) => { setEditando(ev); setOpenForm(true); }} onEstado={cambiarEstado} onDelete={eliminar} />}
      </div>

      {bodegaId && (
        <EventoFormDialog
          open={openForm}
          onOpenChange={(v) => { setOpenForm(v); if (!v) setEditando(null); }}
          bodegaId={editando?.bodega_id ?? bodegaId}
          evento={editando}
        />
      )}
    </div>
  );
}

function FiltrosBar({ filtros, setFiltros }: { filtros: any; setFiltros: any }) {
  function toggle(arr: string[], v: string) {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-muted-foreground mr-1">
        <Filter className="size-3.5" /> Filtros:
      </span>
      {CAL_TIPOS.map((t) => {
        const active = filtros.tipos.includes(t.id);
        const Icon = t.icon;
        return (
          <button key={t.id}
            onClick={() => setFiltros((f: any) => ({ ...f, tipos: toggle(f.tipos, t.id) }))}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${active ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"}`}>
            <Icon className="size-3" /> {t.label}
          </button>
        );
      })}
      <span className="mx-2 h-4 w-px bg-border" />
      {CAL_ESTADOS.map((e) => {
        const active = filtros.estados.includes(e.id);
        return (
          <button key={e.id}
            onClick={() => setFiltros((f: any) => ({ ...f, estados: toggle(f.estados, e.id) }))}
            className={`px-2 py-1 rounded-md border ${active ? e.tone : "bg-card border-border text-muted-foreground hover:bg-muted"}`}>
            {e.label}
          </button>
        );
      })}
      {(filtros.tipos.length || filtros.estados.length) ? (
        <button onClick={() => setFiltros({ tipos: [], estados: [] })} className="px-2 py-1 text-muted-foreground hover:text-foreground underline">
          Limpiar
        </button>
      ) : null}
    </div>
  );
}

function EventoChip({ ev, onClick, compact }: { ev: any; onClick?: () => void; compact?: boolean }) {
  const meta = CAL_TIPO_META[ev.tipo as CalTipo];
  const est = CAL_ESTADO_META[ev.estado as CalEstado];
  const Icon = meta?.icon ?? AlertTriangle;
  const ini = new Date(ev.fecha_inicio);
  const fin = new Date(ev.fecha_fin);
  return (
    <button onClick={onClick} className={`w-full text-left rounded-md border px-1.5 py-1 ${est?.tone ?? ""} hover:brightness-95 transition`}>
      <div className="flex items-center gap-1 text-[11px] leading-tight">
        <Icon className="size-3 shrink-0" style={{ color: meta?.color }} />
        <span className="font-medium truncate flex-1">{ev.titulo}</span>
        {!compact && <span className="text-[10px] opacity-70 shrink-0">{fmtHora(ini)}</span>}
      </div>
      {!compact && (
        <div className="text-[10px] opacity-70 truncate">
          {fmtHora(ini)}–{fmtHora(fin)}
          {ev.deposito_origen && ` · ${ev.deposito_origen}`}
          {ev.deposito_destino && ` → ${ev.deposito_destino}`}
        </div>
      )}
    </button>
  );
}

function VistaMes({ from, cursor, eventos, onOpen, onNuevo }: any) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const monthOf = cursor.getMonth();
  const today = new Date();
  return (
    <div>
      <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
        {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => <div key={d} className="px-2 py-1.5 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(96px,1fr)]">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === monthOf;
          const evs = (eventos as any[]).filter((e) => sameDay(new Date(e.fecha_inicio), d));
          return (
            <div key={i} className={`border-r border-b border-border p-1 overflow-hidden ${inMonth ? "bg-card" : "bg-muted/20"}`}>
              <div className={`text-[11px] mb-1 flex items-center justify-between ${sameDay(d, today) ? "font-semibold text-accent" : inMonth ? "" : "text-muted-foreground"}`}>
                <span>{d.getDate()}</span>
                {evs.length > 0 && <span className="text-[10px] text-muted-foreground">{evs.length}</span>}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e) => <EventoChip key={e.id} ev={e} onClick={() => onOpen(e)} compact />)}
                {evs.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{evs.length - 3} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaSemana({ from, eventos, onOpen }: any) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-7 min-h-[420px]">
      {days.map((d) => {
        const evs = (eventos as any[]).filter((e) => sameDay(new Date(e.fecha_inicio), d))
          .sort((a, b) => +new Date(a.fecha_inicio) - +new Date(b.fecha_inicio));
        return (
          <div key={d.toISOString()} className="border-r border-border last:border-r-0 flex flex-col">
            <div className={`px-2 py-1.5 text-xs border-b border-border ${sameDay(d, today) ? "bg-accent/10 text-accent font-semibold" : "bg-muted/30 text-muted-foreground"}`}>
              {fmtFecha(d)}
            </div>
            <div className="p-1.5 space-y-1 flex-1">
              {evs.length === 0 && <div className="text-[11px] text-muted-foreground italic">—</div>}
              {evs.map((e) => <EventoChip key={e.id} ev={e} onClick={() => onOpen(e)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VistaDia({ day, eventos, onOpen }: any) {
  const evs = (eventos as any[]).filter((e) => sameDay(new Date(e.fecha_inicio), day))
    .sort((a, b) => +new Date(a.fecha_inicio) - +new Date(b.fecha_inicio));
  return (
    <div className="p-3 space-y-2">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{fmtFecha(day)}</div>
      {evs.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Sin eventos programados</div>}
      {evs.map((e) => <EventoChip key={e.id} ev={e} onClick={() => onOpen(e)} />)}
    </div>
  );
}

function VistaAgenda({ eventos, onOpen, onEstado, onDelete }: any) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of eventos as any[]) {
      const k = new Date(e.fecha_inicio).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => +new Date(a[0]) - +new Date(b[0]));
  }, [eventos]);
  if (!grouped.length) return <div className="p-8 text-center text-sm text-muted-foreground">No hay eventos en el rango.</div>;
  return (
    <div className="divide-y divide-border">
      {grouped.map(([day, evs]) => (
        <div key={day} className="p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{fmtFecha(new Date(day))}</div>
          <div className="space-y-1.5">
            {evs.map((e) => {
              const meta = CAL_TIPO_META[e.tipo as CalTipo];
              const est = CAL_ESTADO_META[e.estado as CalEstado];
              const Icon = meta?.icon ?? AlertTriangle;
              return (
                <div key={e.id} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/30">
                  <Icon className="size-4 shrink-0" style={{ color: meta?.color }} />
                  <button className="flex-1 text-left" onClick={() => onOpen(e)}>
                    <div className="text-sm font-medium">{e.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtHora(new Date(e.fecha_inicio))}–{fmtHora(new Date(e.fecha_fin))}
                      {e.deposito_origen && ` · ${e.deposito_origen}`}
                      {e.deposito_destino && ` → ${e.deposito_destino}`}
                    </div>
                  </button>
                  <span className={`text-[11px] px-2 py-0.5 rounded-md border ${est?.tone}`}>{est?.label}</span>
                  <Select value={e.estado} onValueChange={(v) => onEstado(e.id, v)}>
                    <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAL_ESTADOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="text-state-incidencia" onClick={() => onDelete(e.id)}>Eliminar</Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
