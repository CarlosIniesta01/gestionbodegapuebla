import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar as CalendarIcon, AlertTriangle, Truck, ChevronRight } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { eventosHoy } from "@/lib/api/calendario.functions";
import { CAL_TIPO_META, type CalTipo } from "@/lib/calendario-meta";

function fmtHora(d: string) { return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }

export function CalendarioHoyWidget() {
  const { bodegaId } = useActiveBodega();
  const fn = useServerFn(eventosHoy);
  const q = useQuery({
    queryKey: ["calendario-hoy", bodegaId ?? "global"],
    queryFn: () => fn({ data: { bodegaId: bodegaId ?? null } }),
    refetchInterval: 60_000,
  });
  const d = q.data;
  return (
    <section className="rounded-lg border bg-card p-3 sm:p-4" style={{ borderColor: "var(--erp-border)" }}>
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md grid place-items-center bg-accent/10 text-accent">
            <CalendarIcon className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Agenda de hoy</h2>
            <p className="text-[11px] text-muted-foreground">Eventos programados y alertas</p>
          </div>
        </div>
        <Link to="/calendario" className="text-xs text-accent hover:underline inline-flex items-center gap-0.5">
          Ver calendario <ChevronRight className="size-3" />
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <Stat label="Hoy" value={d?.hoy?.length ?? 0} tone="neutral" />
        <Stat label="Cargas/descargas" value={d?.cargasHoy ?? 0} tone="info" icon={<Truck className="size-3" />} />
        <Stat label="Retrasados" value={d?.retrasados?.length ?? 0} tone={(d?.retrasados?.length ?? 0) > 0 ? "danger" : "neutral"} icon={<AlertTriangle className="size-3" />} />
      </div>

      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
        {(d?.hoy ?? []).length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">Sin eventos hoy.</div>
        )}
        {(d?.hoy ?? []).slice(0, 6).map((e: any) => {
          const meta = CAL_TIPO_META[e.tipo as CalTipo];
          const Icon = meta?.icon ?? CalendarIcon;
          return (
            <Link to="/calendario" key={e.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/40">
              <Icon className="size-3.5 shrink-0" style={{ color: meta?.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{e.titulo}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {fmtHora(e.fecha_inicio)} · {meta?.label}
                  {e.deposito_origen && ` · ${e.deposito_origen}`}
                </div>
              </div>
            </Link>
          );
        })}
        {(d?.criticos ?? []).length > 0 && (
          <div className="pt-2 mt-1 border-t" style={{ borderColor: "var(--erp-border)" }}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Próximos críticos</div>
            {d!.criticos.slice(0, 3).map((e: any) => {
              const meta = CAL_TIPO_META[e.tipo as CalTipo];
              const Icon = meta?.icon ?? CalendarIcon;
              return (
                <div key={e.id} className="flex items-center gap-2 p-1 text-[11px]">
                  <Icon className="size-3 shrink-0" style={{ color: meta?.color }} />
                  <span className="flex-1 truncate">{e.titulo}</span>
                  <span className="text-muted-foreground">{new Date(e.fecha_inicio).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: "neutral" | "info" | "danger"; icon?: React.ReactNode }) {
  const color =
    tone === "danger" ? "text-state-incidencia" :
    tone === "info" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-md border p-2" style={{ borderColor: "var(--erp-border)" }}>
      <div className={`text-lg font-semibold leading-none ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1 justify-center">
        {icon} {label}
      </div>
    </div>
  );
}
