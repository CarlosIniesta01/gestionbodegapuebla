import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Activity, Map, FileText, BarChart3, Hammer, Beaker,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Boxes, Droplets,
  ShoppingCart, FlaskConical, TrendingDown,
} from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { getDashboard, type DashboardData } from "@/lib/api/dashboard.functions";
import { getComparativaCentros, type CentroResumen } from "@/lib/api/centros.functions";
import { ESTADO_META } from "@/lib/bodega-data";
import { CentroHeader } from "@/components/CentroHeader";
import { centroIdentity } from "@/lib/centro-identity";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Inicio · Vinea Control" },
      { name: "description", content: "Dashboard de gerencia en tiempo real." },
    ],
  }),
  component: Inicio,
  errorComponent: ({ error }) => (
    <div className="erp-shell min-h-screen p-6">
      <div className="text-sm text-[color:var(--erp-danger)]">Error: {error.message}</div>
    </div>
  ),
  notFoundComponent: () => <div className="erp-shell min-h-screen p-6">No encontrado.</div>,
});

const fmt = (n: number, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "0";

/**
 * Paleta corporativa clara, encapsulada en .erp-shell — solo afecta a Inicio.
 * No modifica el tema oscuro global del resto de módulos.
 */
const erpVars: React.CSSProperties = {
  // colores base
  ["--erp-bg" as any]: "#f6f7f9",
  ["--erp-panel" as any]: "#ffffff",
  ["--erp-border" as any]: "#e4e7ec",
  ["--erp-border-strong" as any]: "#d0d5dd",
  ["--erp-text" as any]: "#0f172a",
  ["--erp-text-muted" as any]: "#667085",
  ["--erp-text-subtle" as any]: "#98a2b3",
  ["--erp-accent" as any]: "#0f5a8a",
  ["--erp-accent-soft" as any]: "#eaf2f8",
  // estados
  ["--erp-success" as any]: "#067647",
  ["--erp-success-soft" as any]: "#ecfdf3",
  ["--erp-warning" as any]: "#b54708",
  ["--erp-warning-soft" as any]: "#fffaeb",
  ["--erp-danger" as any]: "#b42318",
  ["--erp-danger-soft" as any]: "#fef3f2",
  ["--erp-info" as any]: "#175cd3",
  ["--erp-info-soft" as any]: "#eff8ff",
};

function Inicio() {
  const { bodegaId, bodega, isGlobal } = useActiveBodega();
  const fn = useServerFn(getDashboard);
  const fnG = useServerFn(getComparativaCentros);
  const q = useQuery({
    queryKey: ["dashboard", bodegaId],
    queryFn: () => fn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId && !isGlobal,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const qG = useQuery({
    queryKey: ["dashboard-global"],
    queryFn: () => fnG(),
    enabled: isGlobal,
    staleTime: 30_000,
  });

  if (isGlobal) {
    return (
      <div className="erp-shell min-h-screen" style={{ ...erpVars, background: "var(--erp-bg)", color: "var(--erp-text)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-5">
          <CentroHeader showResumen={false} />
          <GlobalDashboard rows={qG.data ?? []} loading={qG.isLoading} />
        </div>
      </div>
    );
  }

  if (!bodegaId) {
    return (
      <div className="erp-shell min-h-screen" style={erpVars}>
        <div className="p-6 text-sm" style={{ color: "var(--erp-text-muted)" }}>Cargando bodega…</div>
      </div>
    );
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="erp-shell min-h-screen" style={erpVars}>
        <div className="p-6 text-sm" style={{ color: "var(--erp-text-muted)" }}>Cargando dashboard…</div>
      </div>
    );
  }
  const d = q.data;
  const isOperario = !d.comercial;
  const now = new Date();

  return (
    <div
      className="erp-shell min-h-screen"
      style={{
        ...erpVars,
        background: "var(--erp-bg)",
        color: "var(--erp-text)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <CentroHeader />
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div
              className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1.5"
              style={{ color: "var(--erp-text-subtle)" }}
            >
              {bodega?.nombre ?? "Bodega"} · {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 className="text-[20px] sm:text-[22px] lg:text-[26px] font-semibold tracking-tight leading-tight">
              Panel de control
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => q.refetch()}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-md border bg-white hover:bg-slate-50 transition-colors"
              style={{ borderColor: "var(--erp-border-strong)", color: "var(--erp-text)" }}
            >
              Actualizar
            </button>
            <Link
              to="/bodega"
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 text-[13px] font-medium rounded-md text-white transition-colors"
              style={{ background: "var(--erp-accent)" }}
            >
              <Map className="size-3.5" />
              <span>Mapa de bodega</span>
            </Link>
          </div>
        </header>

        {/* Alertas */}
        <AlertasBanner d={d} isOperario={isOperario} />

        {/* Accesos rápidos */}
        <QuickActions isOperario={isOperario} />

        {/* KPIs Bodega */}
        <Section title="Bodega">
          <KpiGrid>
            <Kpi label="Ocupación total" value={`${d.bodega.ocupacion_pct}%`} hint={`${fmt(d.bodega.litros_totales)} / ${fmt(d.bodega.capacidad_total)} L`} tone={kpiTone(d.bodega.ocupacion_pct, 70, 90)} />
            <Kpi label="Alcohol absoluto" value={fmt(d.bodega.alcohol_absoluto, 1)} hint="litros AA acumulados" />
            <Kpi label="Depósitos ocupados" value={d.bodega.depositos_ocupados} hint={`${d.bodega.depositos_total} totales en planta`} />
            <Kpi label="Depósitos libres" value={d.bodega.depositos_vacios} hint="disponibles para uso" tone={d.bodega.depositos_vacios === 0 ? "warning" : "neutral"} />
          </KpiGrid>
        </Section>

        {/* KPIs Comercial */}
        {!isOperario && d.comercial && (
          <Section title="Posición comercial">
            <KpiGrid>
              <Kpi label="Compra pendiente" value={`${fmt(d.comercial.compra_pendiente)} L`} hint="contratos por recibir" />
              <Kpi label="Venta pendiente" value={`${fmt(d.comercial.venta_pendiente)} L`} hint="contratos por servir" />
              <Kpi
                label="Disponible comercial"
                value={`${fmt(d.comercial.disponible_total)} L`}
                hint="existencia ± contratos"
                tone={d.comercial.disponible_total < 0 ? "danger" : "success"}
              />
              <Kpi
                label="Productos en negativo"
                value={d.comercial.productos_negativos}
                hint={d.comercial.productos_negativos ? "requieren cobertura" : "todos cubiertos"}
                tone={d.comercial.productos_negativos ? "danger" : "neutral"}
              />
            </KpiGrid>
          </Section>
        )}

        {/* KPIs Almacén */}
        {!isOperario && (
          <Section title="Almacén enológico">
            <KpiGrid>
              <Kpi label="Bajo stock mínimo" value={d.almacen.bajo_minimo} hint="productos enológicos" tone={d.almacen.bajo_minimo ? "warning" : "neutral"} />
              <Kpi label="Stock crítico" value={d.almacen.en_critico} hint="reposición urgente" tone={d.almacen.en_critico ? "danger" : "neutral"} />
              <Kpi label="Lotes por caducar" value={d.almacen.lotes_por_caducar} hint="caducidad ≤ 30 días" tone={d.almacen.lotes_por_caducar ? "warning" : "neutral"} />
              <Kpi label="Lotes caducados" value={d.almacen.lotes_caducados} hint="con stock disponible" tone={d.almacen.lotes_caducados ? "danger" : "neutral"} />
            </KpiGrid>
          </Section>
        )}

        {/* KPIs Operaciones */}
        <Section title="Operaciones">
          <KpiGrid>
            <Kpi label="Trabajos pendientes" value={d.operaciones.pendientes} hint="en cola de ejecución" />
            <Kpi label="En curso" value={d.operaciones.en_proceso} hint="iniciados hoy" />
            <Kpi label="Finalizados hoy" value={d.operaciones.finalizados_hoy} hint="completados" tone={d.operaciones.finalizados_hoy ? "success" : "neutral"} />
            <Kpi label="Incidencias abiertas" value={d.operaciones.incidencias} hint="sin resolver" tone={d.operaciones.incidencias ? "danger" : "neutral"} />
          </KpiGrid>
        </Section>

        {/* Paneles inferiores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Panel title="Reparto por estado de depósito" to="/bodega" linkLabel="Mapa">
            {d.bodega.reparto_estado.length === 0 ? (
              <Empty>Sin datos</Empty>
            ) : (
              <div className="space-y-2.5">
                {d.bodega.reparto_estado.map(({ estado, n }) => {
                  const meta = (ESTADO_META as any)[estado] ?? { label: estado, color: "#94a3b8" };
                  const pct = d.bodega.depositos_total ? (n / d.bodega.depositos_total) * 100 : 0;
                  return (
                    <div key={estado} className="flex items-center gap-3 text-[13px]">
                      <span className="size-2 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="w-28 sm:w-36 truncate" style={{ color: "var(--erp-text)" }}>{meta.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-0" style={{ background: "var(--erp-bg)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color, opacity: 0.85 }} />
                      </div>
                      <span className="w-8 text-right tabular-nums" style={{ color: "var(--erp-text-muted)" }}>{n}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Depósitos en riesgo de saturación" to="/bodega" linkLabel="Mapa">
            {d.bodega.depositos_llenos.length === 0 ? (
              <Empty>Ningún depósito por encima del 90 %</Empty>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--erp-text-subtle)" }} className="text-[11px] uppercase tracking-wider">
                    <th className="text-left font-medium pb-2">Código</th>
                    <th className="text-left font-medium pb-2">Ocupación</th>
                    <th className="text-right font-medium pb-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {d.bodega.depositos_llenos.map((x) => (
                    <tr key={x.id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                      <td className="py-2 font-mono text-[12px]">{x.codigo}</td>
                      <td className="py-2 min-w-0">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--erp-bg)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(x.pct, 100)}%`,
                              background: x.pct >= 95 ? "var(--erp-danger)" : "var(--erp-warning)",
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">{x.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {!isOperario && d.comercial && (
            <Panel title="Disponible comercial por producto" to="/posicion-comercial" linkLabel="Detalle">
              {d.comercial.top_productos.length === 0 ? (
                <Empty>Sin productos</Empty>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ color: "var(--erp-text-subtle)" }} className="text-[11px] uppercase tracking-wider">
                      <th className="text-left font-medium pb-2">Producto</th>
                      <th className="text-right font-medium pb-2 hidden sm:table-cell">Existencia</th>
                      <th className="text-right font-medium pb-2">Disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.comercial.top_productos.map((p) => {
                      const tone = p.disponible < 0 ? "var(--erp-danger)" : p.disponible < 1000 ? "var(--erp-warning)" : "var(--erp-success)";
                      return (
                        <tr key={p.producto_id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                          <td className="py-2 truncate max-w-0">{p.nombre}</td>
                          <td className="py-2 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--erp-text-muted)" }}>{fmt(p.existencia)} L</td>
                          <td className="py-2 text-right tabular-nums font-medium" style={{ color: tone }}>{fmt(p.disponible)} L</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Panel>
          )}

          {!isOperario && (
            <Panel title="Productos en alerta de stock" to="/almacen" linkLabel="Almacén">
              {d.almacen.productos_alerta.length === 0 ? (
                <Empty>Stock correcto en todos los productos</Empty>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ color: "var(--erp-text-subtle)" }} className="text-[11px] uppercase tracking-wider">
                      <th className="text-left font-medium pb-2">Producto</th>
                      <th className="text-right font-medium pb-2 hidden sm:table-cell">Mínimo</th>
                      <th className="text-right font-medium pb-2">Stock</th>
                      <th className="text-right font-medium pb-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.almacen.productos_alerta.map((p) => (
                      <tr key={p.producto_id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                        <td className="py-2 truncate max-w-0">{p.nombre}</td>
                        <td className="py-2 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--erp-text-muted)" }}>{p.minimo != null ? fmt(p.minimo) : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{fmt(p.stock, 1)}</td>
                        <td className="py-2 text-right">
                          <StatusPill tone={p.nivel === "critico" ? "danger" : "warning"}>
                            {p.nivel === "critico" ? "Crítico" : "Bajo"}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          )}

          <Panel title="Trabajos atrasados" to="/trabajos" linkLabel="Trabajos" className={isOperario ? "lg:col-span-2" : ""}>
            {d.operaciones.atrasados.length === 0 ? (
              <Empty>Sin trabajos atrasados</Empty>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--erp-text-subtle)" }} className="text-[11px] uppercase tracking-wider">
                    <th className="text-left font-medium pb-2">Trabajo</th>
                    <th className="text-right font-medium pb-2 hidden sm:table-cell">Prioridad</th>
                    <th className="text-right font-medium pb-2">Programado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.operaciones.atrasados.map((t) => (
                    <tr key={t.id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                      <td className="py-2 truncate max-w-0">{t.titulo}</td>
                      <td className="py-2 text-right hidden sm:table-cell">
                        <StatusPill tone={t.prioridad === "urgente" ? "danger" : t.prioridad === "alta" ? "warning" : "info"}>
                          {t.prioridad}
                        </StatusPill>
                      </td>
                      <td className="py-2 text-right tabular-nums" style={{ color: "var(--erp-text-muted)" }}>
                        {t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {!isOperario && (
            <Panel title="Lotes próximos a caducar" to="/almacen" linkLabel="Almacén">
              {d.almacen.lotes_alerta.length === 0 ? (
                <Empty>Sin caducidades próximas</Empty>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ color: "var(--erp-text-subtle)" }} className="text-[11px] uppercase tracking-wider">
                      <th className="text-left font-medium pb-2">Lote</th>
                      <th className="text-left font-medium pb-2 hidden sm:table-cell">Producto</th>
                      <th className="text-right font-medium pb-2">Caduca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.almacen.lotes_alerta.map((l) => (
                      <tr key={l.id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                        <td className="py-2 font-mono text-[12px]">{l.numero_lote}</td>
                        <td className="py-2 truncate max-w-0 hidden sm:table-cell">{l.producto}</td>
                        <td className="py-2 text-right">
                          <StatusPill tone={l.dias <= 7 ? "danger" : "warning"}>
                            {l.dias} d
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          )}
        </div>

        <footer className="pt-2 pb-1 text-[11px]" style={{ color: "var(--erp-text-subtle)" }}>
          Datos sincronizados a las {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </footer>
      </div>
    </div>
  );
}

/* ---------------- componentes UI internos ---------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--erp-text-subtle)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">{children}</div>;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function kpiTone(value: number, warn: number, danger: number): Tone {
  if (value >= danger) return "danger";
  if (value >= warn) return "warning";
  return "neutral";
}

function Kpi({
  label, value, hint, tone = "neutral",
}: { label: string; value: string | number; hint?: string; tone?: Tone }) {
  const dotColor = tone === "danger" ? "var(--erp-danger)"
    : tone === "warning" ? "var(--erp-warning)"
    : tone === "success" ? "var(--erp-success)"
    : tone === "info" ? "var(--erp-info)"
    : "transparent";
  return (
    <div
      className="rounded-lg p-3.5 sm:p-4 bg-white"
      style={{
        border: "1px solid var(--erp-border)",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {tone !== "neutral" && <span className="size-1.5 rounded-full" style={{ background: dotColor }} />}
        <div className="text-[11px] font-medium uppercase tracking-wider truncate" style={{ color: "var(--erp-text-subtle)" }}>
          {label}
        </div>
      </div>
      <div className="text-[22px] sm:text-[24px] font-semibold tabular-nums leading-tight" style={{ color: "var(--erp-text)" }}>
        {value}
      </div>
      {hint && (
        <div className="text-[11.5px] mt-1 truncate" style={{ color: "var(--erp-text-muted)" }}>{hint}</div>
      )}
    </div>
  );
}

function Panel({
  title, to, linkLabel, children, className = "",
}: { title: string; to?: string; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg bg-white ${className}`}
      style={{
        border: "1px solid var(--erp-border)",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--erp-border)" }}
      >
        <div className="text-[13px] font-semibold" style={{ color: "var(--erp-text)" }}>{title}</div>
        {to && (
          <Link
            to={to}
            className="text-[12px] inline-flex items-center gap-0.5 hover:underline"
            style={{ color: "var(--erp-accent)" }}
          >
            {linkLabel ?? "Ver"} <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] py-2" style={{ color: "var(--erp-text-muted)" }}>{children}</div>;
}

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const map: Record<Tone, { bg: string; fg: string; bd: string }> = {
    danger: { bg: "var(--erp-danger-soft)", fg: "var(--erp-danger)", bd: "#fecdca" },
    warning: { bg: "var(--erp-warning-soft)", fg: "var(--erp-warning)", bd: "#fedf89" },
    success: { bg: "var(--erp-success-soft)", fg: "var(--erp-success)", bd: "#abefc6" },
    info: { bg: "var(--erp-info-soft)", fg: "var(--erp-info)", bd: "#b2ddff" },
    neutral: { bg: "#f2f4f7", fg: "#475467", bd: "#e4e7ec" },
  };
  const s = map[tone];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border tabular-nums"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
    >
      {children}
    </span>
  );
}

function AlertasBanner({ d, isOperario }: { d: DashboardData; isOperario: boolean }) {
  const items: Array<{ label: string; n: number; to: string; tone: "danger" | "warning" }> = [];
  if (!isOperario) {
    if (d.alertas.contratos_vencidos) items.push({ label: "Contratos vencidos", n: d.alertas.contratos_vencidos, to: "/contratos", tone: "danger" });
    if (d.alertas.contratos_por_vencer) items.push({ label: "Contratos por vencer", n: d.alertas.contratos_por_vencer, to: "/contratos", tone: "warning" });
    if (d.comercial && d.comercial.productos_negativos) items.push({ label: "Disponible comercial negativo", n: d.comercial.productos_negativos, to: "/posicion-comercial", tone: "danger" });
    if (d.almacen.en_critico) items.push({ label: "Stock crítico", n: d.almacen.en_critico, to: "/almacen", tone: "danger" });
    if (d.almacen.bajo_minimo) items.push({ label: "Bajo mínimo", n: d.almacen.bajo_minimo, to: "/almacen", tone: "warning" });
    if (d.almacen.lotes_caducados) items.push({ label: "Lotes caducados", n: d.almacen.lotes_caducados, to: "/almacen", tone: "danger" });
    if (d.almacen.lotes_por_caducar) items.push({ label: "Lotes próximos a caducar", n: d.almacen.lotes_por_caducar, to: "/almacen", tone: "warning" });
    if (d.alertas.depositos_llenos) items.push({ label: "Depósitos en riesgo", n: d.alertas.depositos_llenos, to: "/bodega", tone: "warning" });
  }
  if (d.operaciones.atrasados.length) items.push({ label: "Trabajos atrasados", n: d.operaciones.atrasados.length, to: "/trabajos", tone: "danger" });
  if (d.operaciones.incidencias) items.push({ label: "Incidencias abiertas", n: d.operaciones.incidencias, to: "/trabajos", tone: "danger" });

  items.sort((a, b) => (a.tone === "danger" ? -1 : 1) - (b.tone === "danger" ? -1 : 1));

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg px-4 py-3 flex items-center gap-2.5 bg-white"
        style={{ border: "1px solid var(--erp-border)" }}
      >
        <CheckCircle2 className="size-4" style={{ color: "var(--erp-success)" }} />
        <div className="text-[13px]" style={{ color: "var(--erp-text-muted)" }}>
          Sin alertas críticas. Operación dentro de parámetros.
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg bg-white"
      style={{ border: "1px solid var(--erp-border)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: "var(--erp-border)" }}
      >
        <AlertTriangle className="size-3.5" style={{ color: "var(--erp-danger)" }} />
        <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--erp-text)" }}>
          Alertas prioritarias
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--erp-text-subtle)" }}>
          {items.length} elementos
        </span>
      </div>
      <div className="p-3 flex flex-wrap gap-1.5">
        {items.map((a, i) => {
          const bg = a.tone === "danger" ? "var(--erp-danger-soft)" : "var(--erp-warning-soft)";
          const fg = a.tone === "danger" ? "var(--erp-danger)" : "var(--erp-warning)";
          const bd = a.tone === "danger" ? "#fecdca" : "#fedf89";
          return (
            <Link
              key={i}
              to={a.to}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-colors hover:opacity-90"
              style={{ background: bg, color: fg, borderColor: bd }}
            >
              <span className="tabular-nums font-semibold">{a.n}</span>
              <span>{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function QuickActions({ isOperario }: { isOperario: boolean }) {
  const actions: Array<{ to: string; label: string; icon: any; admin?: boolean }> = [
    { to: "/bodega", label: "Movimiento", icon: Droplets },
    { to: "/trabajos", label: "Nuevo trabajo", icon: Hammer },
    { to: "/almacen", label: "Entrada de lote", icon: FlaskConical, admin: true },
    { to: "/contratos", label: "Nuevo contrato", icon: FileText, admin: true },
    { to: "/posicion-comercial", label: "Posición comercial", icon: BarChart3, admin: true },
    { to: "/almacen", label: "Almacén", icon: Beaker, admin: true },
    { to: "/bodega", label: "Mapa de bodega", icon: Boxes },
  ];
  const filtered = actions.filter((a) => !a.admin || !isOperario);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {filtered.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={`${a.to}-${a.label}`}
            to={a.to}
            className="group bg-white rounded-md px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-slate-50"
            style={{ border: "1px solid var(--erp-border)" }}
          >
            <span
              className="size-7 rounded-md grid place-items-center shrink-0"
              style={{ background: "var(--erp-accent-soft)", color: "var(--erp-accent)" }}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--erp-text)" }}>
              {a.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function GlobalDashboard({ rows, loading }: { rows: CentroResumen[]; loading: boolean }) {
  const tot = rows.reduce((s, r) => ({
    cap: s.cap + r.capacidad_total,
    lit: s.lit + r.litros_totales,
    occ: s.occ + r.depositos_ocupados,
    lib: s.lib + r.depositos_vacios,
    trab: s.trab + r.trabajos_abiertos,
    inc: s.inc + r.incidencias_abiertas,
    mov: s.mov + r.movimientos_hoy,
    cont: s.cont + r.contratos_pendientes,
    disp: s.disp + r.disponible_comercial,
  }), { cap: 0, lit: 0, occ: 0, lib: 0, trab: 0, inc: 0, mov: 0, cont: 0, disp: 0 });
  const ocupGlobal = tot.cap > 0 ? Math.round((tot.lit / tot.cap) * 100) : 0;

  if (loading) return <div className="p-6 text-sm" style={{ color: "var(--erp-text-muted)" }}>Cargando consolidado…</div>;

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1.5" style={{ color: "var(--erp-text-subtle)" }}>
          Consolidado · {rows.length} centro{rows.length === 1 ? "" : "s"}
        </div>
        <h1 className="text-[20px] sm:text-[22px] lg:text-[26px] font-semibold tracking-tight leading-tight">
          Visión global de empresa
        </h1>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {[
          { l: "Ocupación", v: `${ocupGlobal}%` },
          { l: "Litros totales", v: tot.lit.toLocaleString("es-ES") },
          { l: "Capacidad", v: tot.cap.toLocaleString("es-ES") },
          { l: "Dep. ocupados", v: `${tot.occ}` },
          { l: "Dep. libres", v: `${tot.lib}` },
          { l: "Trabajos abiertos", v: `${tot.trab}` },
          { l: "Incidencias", v: `${tot.inc}` },
          { l: "Movimientos hoy", v: `${tot.mov}` },
          { l: "Contratos pdtes.", v: `${tot.cont}` },
          { l: "Disponible (L)", v: tot.disp.toLocaleString("es-ES") },
        ].map((k) => (
          <div key={k.l} className="bg-white rounded-md px-3 py-2.5" style={{ border: "1px solid var(--erp-border)" }}>
            <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--erp-text-subtle)" }}>{k.l}</div>
            <div className="text-[16px] font-semibold mt-0.5" style={{ color: "var(--erp-text)" }}>{k.v}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold tracking-tight">Centros</h2>
          <Link to="/comparativa" className="text-[12px] text-primary inline-flex items-center gap-1">
            Ver comparativa <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {rows.map((r) => {
            const ident = centroIdentity({ id: r.bodega_id, nombre: r.nombre });
            const I = ident.Icon;
            return (
              <div key={r.bodega_id} className="bg-white rounded-md p-3.5"
                   style={{ border: "1px solid var(--erp-border)", borderTop: `3px solid ${ident.color}` }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-flex items-center justify-center rounded-md size-8 shrink-0"
                        style={{ background: ident.soft, color: ident.text }}>
                    <I className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">{r.nombre}</div>
                    <div className="text-[11px]" style={{ color: "var(--erp-text-subtle)" }}>
                      {r.depositos_total} depósitos · {r.capacidad_total.toLocaleString("es-ES")} L cap.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Ocupación</span><span className="font-semibold">{r.ocupacion_pct}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Litros</span><span className="font-mono">{r.litros_totales.toLocaleString("es-ES")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Trabajos</span><span>{r.trabajos_abiertos}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Incid.</span><span className={r.incidencias_abiertas ? "text-destructive font-semibold" : ""}>{r.incidencias_abiertas}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mov. hoy</span><span>{r.movimientos_hoy}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Trasiegos</span><span>{r.trasiegos_activos}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
