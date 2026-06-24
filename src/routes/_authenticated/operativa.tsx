import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Clock, Hammer, Droplets, CheckCircle2,
  AlertCircle, Sparkles, Activity, Boxes,
} from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { CentroHeader } from "@/components/CentroHeader";
import { getOperativaCentro } from "@/lib/api/centros.functions";
import { centroIdentity } from "@/lib/centro-identity";

export const Route = createFileRoute("/_authenticated/operativa")({
  head: () => ({
    meta: [
      { title: "Operativa del centro · Vinea Control" },
      { name: "description", content: "Visión diaria operativa de cada centro." },
    ],
  }),
  component: OperativaPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">No encontrado.</div>,
});

function Section({ title, icon, children, tone = "neutral" }: {
  title: string; icon: any; children: React.ReactNode; tone?: "neutral" | "warn" | "danger" | "ok";
}) {
  const Icon = icon;
  const palette: Record<string, string> = {
    neutral: "var(--muted-foreground)", ok: "#067647", warn: "#b54708", danger: "#b42318",
  };
  return (
    <div className="rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
        <Icon className="size-4" style={{ color: palette[tone] }} />
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-muted-foreground py-2">{children}</div>;
}

function OperativaPage() {
  const { bodegaId, bodega, isGlobal } = useActiveBodega();
  const fn = useServerFn(getOperativaCentro);
  const q = useQuery({
    queryKey: ["operativa-centro", bodegaId],
    queryFn: () => fn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId && !isGlobal,
    staleTime: 15_000,
  });

  if (!bodegaId) return <div className="p-6 text-muted-foreground">Cargando…</div>;

  if (isGlobal) {
    return (
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
        <CentroHeader />
        <div className="rounded-lg border bg-card p-6 text-center" style={{ borderColor: "var(--border)" }}>
          <Boxes className="size-8 mx-auto mb-2 text-muted-foreground" />
          <div className="text-[14px] font-medium">Visión global activa</div>
          <div className="text-[12px] text-muted-foreground mt-1">
            Selecciona un centro para ver su operativa diaria, o consulta la <Link to="/comparativa" className="text-primary underline">comparativa de centros</Link>.
          </div>
        </div>
      </div>
    );
  }

  const d = q.data;
  const ident = centroIdentity(bodega);
  const today = new Date().toISOString().slice(0, 10);

  const trabajos = d?.trabajos ?? [];
  const pendientes = trabajos.filter((t) => t.estado === "pendiente");
  const enCurso = trabajos.filter((t) => t.estado === "en_proceso" || t.estado === "en_curso");
  const vencidos = trabajos.filter((t) => t.scheduled_at && new Date(t.scheduled_at) < new Date() && !["finalizado", "completado", "cancelado"].includes(t.estado));
  const finalizadosHoy = trabajos.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === today);
  const incidencias = trabajos.filter((t) => t.tipo === "incidencia" && !["finalizado", "completado", "cancelado"].includes(t.estado));
  const bloqueadas = trabajos.filter((t) => t.estado === "bloqueado");

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <CentroHeader />

      {q.isLoading || !d ? (
        <div className="p-6 text-sm text-muted-foreground">Cargando operativa…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <Section title="Trabajos pendientes" icon={Clock} tone="warn">
              {pendientes.length === 0 ? <Empty>Sin trabajos pendientes.</Empty> : (
                <ul className="space-y-1.5">
                  {pendientes.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">{t.titulo}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.prioridad}</span>
                    </li>
                  ))}
                  {pendientes.length > 8 && <li className="text-[11px] text-muted-foreground">+ {pendientes.length - 8} más…</li>}
                </ul>
              )}
            </Section>

            <Section title="Trabajos en curso" icon={Hammer}>
              {enCurso.length === 0 ? <Empty>Nada en curso ahora mismo.</Empty> : (
                <ul className="space-y-1.5">
                  {enCurso.slice(0, 8).map((t) => (
                    <li key={t.id} className="text-[12px] truncate">{t.titulo}</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Trabajos vencidos" icon={AlertTriangle} tone="danger">
              {vencidos.length === 0 ? <Empty>Sin vencidos.</Empty> : (
                <ul className="space-y-1.5">
                  {vencidos.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">{t.titulo}</span>
                      <span className="text-[10px] text-destructive">{t.scheduled_at?.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Finalizados hoy" icon={CheckCircle2} tone="ok">
              {finalizadosHoy.length === 0 ? <Empty>Aún ninguno hoy.</Empty> : (
                <ul className="space-y-1.5">
                  {finalizadosHoy.slice(0, 8).map((t) => (
                    <li key={t.id} className="text-[12px] truncate">{t.titulo}</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Incidencias abiertas" icon={AlertCircle} tone="danger">
              {incidencias.length === 0 ? <Empty>Sin incidencias abiertas.</Empty> : (
                <ul className="space-y-1.5">
                  {incidencias.slice(0, 8).map((t) => (
                    <li key={t.id} className="text-[12px] truncate">{t.titulo}</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Tareas bloqueadas" icon={AlertCircle} tone="warn">
              {bloqueadas.length === 0 ? <Empty>Sin tareas bloqueadas.</Empty> : (
                <ul className="space-y-1.5">
                  {bloqueadas.slice(0, 8).map((t) => (
                    <li key={t.id} className="text-[12px] truncate">{t.titulo}</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Movimientos del día" icon={Activity}>
              {d.movimientos_hoy.length === 0 ? <Empty>Sin movimientos hoy.</Empty> : (
                <ul className="space-y-1.5">
                  {d.movimientos_hoy.slice(0, 10).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="capitalize">{m.tipo}</span>
                      <span className="font-mono">{m.litros.toLocaleString("es-ES")} L</span>
                    </li>
                  ))}
                  {d.movimientos_hoy.length > 10 && <li className="text-[11px] text-muted-foreground">+ {d.movimientos_hoy.length - 10} más…</li>}
                </ul>
              )}
            </Section>

            <Section title="Trasiegos activos" icon={Droplets}>
              {d.trasiegos_activos.length === 0 ? <Empty>Sin trasiegos activos.</Empty> : (
                <ul className="space-y-1.5">
                  {d.trasiegos_activos.slice(0, 8).map((t) => (
                    <li key={t.id} className="text-[12px]">{t.litros.toLocaleString("es-ES")} L</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Depósitos limpieza" icon={Sparkles}>
              {d.depositos_limpieza.length === 0 ? <Empty>Ninguno en limpieza.</Empty> : (
                <ul className="flex flex-wrap gap-1.5">
                  {d.depositos_limpieza.map((x) => (
                    <li key={x.id} className="px-2 py-0.5 rounded-md text-[11px] font-mono"
                        style={{ background: ident.soft, color: ident.text }}>
                      {x.codigo}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Depósitos > 90% ocupación" icon={AlertTriangle} tone="warn">
              {d.depositos_alta_ocupacion.length === 0 ? <Empty>Sin depósitos saturados.</Empty> : (
                <ul className="space-y-1.5">
                  {d.depositos_alta_ocupacion.slice(0, 10).map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-mono">{x.codigo}</span>
                      <span className="font-semibold">{x.pct}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
