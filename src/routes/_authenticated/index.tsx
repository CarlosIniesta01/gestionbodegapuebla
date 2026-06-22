import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes, Droplets, AlertTriangle, Activity, Map, FlaskConical, FileText,
  BarChart3, Hammer, ShoppingCart, Beaker, TrendingDown, TrendingUp,
  CheckCircle2, Clock, AlertCircle, Plus, ChevronRight, Wine, Package,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { getDashboard, type DashboardData } from "@/lib/api/dashboard.functions";
import { ESTADO_META } from "@/lib/bodega-data";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Inicio · Vinea Control" },
      { name: "description", content: "Dashboard de gerencia en tiempo real." },
    ],
  }),
  component: Inicio,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-rose-500">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">No encontrado.</div>,
});

const fmt = (n: number, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "0";

function Inicio() {
  const { bodegaId, bodega } = useActiveBodega();
  const fn = useServerFn(getDashboard);
  const q = useQuery({
    queryKey: ["dashboard", bodegaId],
    queryFn: () => fn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!bodegaId) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando bodega…</div>;
  }
  if (q.isLoading || !q.data) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando dashboard…</div>;
  }
  const d = q.data;
  const isOperario = !d.comercial;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1 truncate">
            {bodega?.nombre ?? "Bodega"} · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-semibold tracking-tight">
            Dashboard <span className="text-accent">Gerencia</span>
          </h1>
        </div>
        <Link
          to="/bodega"
          className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg inline-flex items-center gap-2"
        >
          <Map className="size-4" /> <span className="hidden sm:inline">Ir al mapa</span>
        </Link>
      </header>

      {/* Alertas críticas */}
      <AlertasBanner d={d} isOperario={isOperario} />

      {/* Accesos rápidos */}
      <QuickActions isOperario={isOperario} />

      {/* KPIs Bodega */}
      <Section title="Bodega" icon={Boxes}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            label="Ocupación"
            value={`${d.bodega.ocupacion_pct}%`}
            hint={`${fmt(d.bodega.litros_totales)} / ${fmt(d.bodega.capacidad_total)} L`}
            icon={Droplets}
            accent="var(--primary)"
          />
          <StatCard
            label="Alcohol absoluto"
            value={fmt(d.bodega.alcohol_absoluto, 1)}
            hint="litros AA"
            icon={Wine}
            accent="var(--accent)"
          />
          <StatCard
            label="Depósitos ocupados"
            value={d.bodega.depositos_ocupados}
            hint={`${d.bodega.depositos_total} totales`}
            icon={Boxes}
            accent="var(--state-fermentacion)"
          />
          <StatCard
            label="Depósitos vacíos"
            value={d.bodega.depositos_vacios}
            hint="disponibles"
            icon={Boxes}
            accent="var(--state-empty)"
          />
        </div>
      </Section>

      {/* KPIs Comercial */}
      {!isOperario && d.comercial && (
        <Section title="Comercial" icon={BarChart3}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              label="Compra pendiente"
              value={`${fmt(d.comercial.compra_pendiente)} L`}
              icon={ShoppingCart}
              accent="var(--state-fermentacion)"
            />
            <StatCard
              label="Venta pendiente"
              value={`${fmt(d.comercial.venta_pendiente)} L`}
              icon={TrendingUp}
              accent="var(--accent)"
            />
            <StatCard
              label="Disponible comercial"
              value={`${fmt(d.comercial.disponible_total)} L`}
              icon={d.comercial.disponible_total < 0 ? TrendingDown : TrendingUp}
              accent={d.comercial.disponible_total < 0 ? "var(--state-incidencia)" : "var(--primary)"}
            />
            <StatCard
              label="Productos negativos"
              value={d.comercial.productos_negativos}
              hint={d.comercial.productos_negativos ? "requieren atención" : "todo correcto"}
              icon={AlertCircle}
              accent={d.comercial.productos_negativos ? "var(--state-incidencia)" : "var(--state-empty)"}
            />
          </div>
        </Section>
      )}

      {/* KPIs Almacén */}
      {!isOperario && (
        <Section title="Almacén enológico" icon={Beaker}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              label="Bajo stock mínimo"
              value={d.almacen.bajo_minimo}
              icon={Package}
              accent={d.almacen.bajo_minimo ? "var(--state-llenado)" : "var(--state-empty)"}
            />
            <StatCard
              label="Stock crítico"
              value={d.almacen.en_critico}
              icon={AlertTriangle}
              accent={d.almacen.en_critico ? "var(--state-incidencia)" : "var(--state-empty)"}
            />
            <StatCard
              label="Próximos a caducar"
              value={d.almacen.lotes_por_caducar}
              hint="≤ 30 días"
              icon={Clock}
              accent={d.almacen.lotes_por_caducar ? "var(--state-llenado)" : "var(--state-empty)"}
            />
            <StatCard
              label="Lotes caducados"
              value={d.almacen.lotes_caducados}
              icon={AlertCircle}
              accent={d.almacen.lotes_caducados ? "var(--state-incidencia)" : "var(--state-empty)"}
            />
          </div>
        </Section>
      )}

      {/* KPIs Operaciones */}
      <Section title="Operaciones" icon={Hammer}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            label="Trabajos pendientes"
            value={d.operaciones.pendientes}
            icon={Clock}
            accent="var(--state-llenado)"
          />
          <StatCard
            label="En proceso"
            value={d.operaciones.en_proceso}
            icon={Activity}
            accent="var(--state-fermentacion)"
          />
          <StatCard
            label="Finalizados hoy"
            value={d.operaciones.finalizados_hoy}
            icon={CheckCircle2}
            accent="var(--state-empty)"
          />
          <StatCard
            label="Incidencias abiertas"
            value={d.operaciones.incidencias}
            icon={AlertTriangle}
            accent={d.operaciones.incidencias ? "var(--state-incidencia)" : "var(--state-empty)"}
          />
        </div>
      </Section>

      {/* Paneles detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Panel title="Reparto por estado de depósito" to="/bodega">
          <div className="space-y-2">
            {d.bodega.reparto_estado.length === 0 && (
              <div className="text-xs text-muted-foreground">Sin datos</div>
            )}
            {d.bodega.reparto_estado.map(({ estado, n }) => {
              const meta = (ESTADO_META as any)[estado] ?? { label: estado, color: "var(--muted)" };
              const pct = d.bodega.depositos_total ? (n / d.bodega.depositos_total) * 100 : 0;
              return (
                <div key={estado} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="w-24 sm:w-32 text-muted-foreground truncate">{meta.label}</span>
                  <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden min-w-0">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Depósitos con mayor ocupación" to="/bodega">
          {d.bodega.depositos_llenos.length === 0 ? (
            <div className="text-xs text-muted-foreground">Ningún depósito por encima del 90 %</div>
          ) : (
            <div className="space-y-2">
              {d.bodega.depositos_llenos.map((x) => (
                <div key={x.id} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <span className="font-mono w-14 sm:w-16 shrink-0 truncate">{x.codigo}</span>
                  <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(x.pct, 100)}%`,
                        background: x.pct >= 95 ? "var(--state-incidencia)" : "var(--state-llenado)",
                      }}
                    />
                  </div>
                  <span className="w-12 text-right tabular-nums">{x.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {!isOperario && d.comercial && (
          <Panel title="Top productos · disponible comercial" to="/posicion-comercial">
            {d.comercial.top_productos.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sin productos</div>
            ) : (
              <div className="space-y-2">
                {d.comercial.top_productos.map((p) => {
                  const color =
                    p.disponible < 0 ? "var(--state-incidencia)" :
                    p.disponible < 1000 ? "var(--state-llenado)" : "var(--state-empty)";
                  return (
                    <div key={p.producto_id} className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                      <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="flex-1 truncate">{p.nombre}</span>
                      <span className="tabular-nums shrink-0">{fmt(p.disponible)} L</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {!isOperario && (
          <Panel title="Productos en alerta de stock" to="/almacen">
            {d.almacen.productos_alerta.length === 0 ? (
              <div className="text-xs text-muted-foreground">Stock correcto en todos los productos</div>
            ) : (
              <div className="space-y-2">
                {d.almacen.productos_alerta.map((p) => (
                  <div key={p.producto_id} className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: p.nivel === "critico" ? "var(--state-incidencia)" : "var(--state-llenado)" }}
                    />
                    <span className="flex-1 truncate">{p.nombre}</span>
                    <span className="tabular-nums shrink-0 text-muted-foreground">
                      {fmt(p.stock, 1)} / {p.minimo != null ? fmt(p.minimo, 0) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        <Panel title="Trabajos atrasados" to="/trabajos" className={isOperario ? "lg:col-span-2" : ""}>
          {d.operaciones.atrasados.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sin trabajos atrasados</div>
          ) : (
            <div className="space-y-2">
              {d.operaciones.atrasados.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{
                      background: t.prioridad === "urgente" ? "var(--state-incidencia)" :
                                  t.prioridad === "alta" ? "var(--state-llenado)" : "var(--accent)",
                    }}
                  />
                  <span className="flex-1 truncate">{t.titulo}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                    {t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {!isOperario && (
          <Panel title="Lotes próximos a caducar" to="/almacen">
            {d.almacen.lotes_alerta.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sin caducidades próximas</div>
            ) : (
              <div className="space-y-2">
                {d.almacen.lotes_alerta.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: l.dias <= 7 ? "var(--state-incidencia)" : "var(--state-llenado)" }}
                    />
                    <span className="flex-1 truncate">
                      <span className="font-mono text-[11px] text-muted-foreground mr-1">{l.numero_lote}</span>
                      {l.producto}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                      {l.dias} d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function Section({
  title, icon: Icon, children,
}: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="space-y-2 sm:space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <h2 className="text-[11px] sm:text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Panel({
  title, to, children, className = "",
}: { title: string; to?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`scada-panel p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        {to && (
          <Link to={to} className="text-[11px] text-accent hover:text-accent/80 inline-flex items-center gap-0.5">
            Ver <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function AlertasBanner({ d, isOperario }: { d: DashboardData; isOperario: boolean }) {
  const alertas: Array<{ label: string; n: number; to: string; level: "rojo" | "amarillo" }> = [];
  if (!isOperario) {
    if (d.alertas.contratos_vencidos > 0)
      alertas.push({ label: "Contratos vencidos", n: d.alertas.contratos_vencidos, to: "/contratos", level: "rojo" });
    if (d.alertas.contratos_por_vencer > 0)
      alertas.push({ label: "Contratos por vencer", n: d.alertas.contratos_por_vencer, to: "/contratos", level: "amarillo" });
    if (d.comercial && d.comercial.productos_negativos > 0)
      alertas.push({ label: "Disponible negativo", n: d.comercial.productos_negativos, to: "/posicion-comercial", level: "rojo" });
    if (d.almacen.en_critico > 0)
      alertas.push({ label: "Stock crítico", n: d.almacen.en_critico, to: "/almacen", level: "rojo" });
    if (d.almacen.bajo_minimo > 0)
      alertas.push({ label: "Bajo mínimo", n: d.almacen.bajo_minimo, to: "/almacen", level: "amarillo" });
    if (d.almacen.lotes_caducados > 0)
      alertas.push({ label: "Lotes caducados", n: d.almacen.lotes_caducados, to: "/almacen", level: "rojo" });
    if (d.almacen.lotes_por_caducar > 0)
      alertas.push({ label: "Lotes por caducar", n: d.almacen.lotes_por_caducar, to: "/almacen", level: "amarillo" });
    if (d.alertas.depositos_llenos > 0)
      alertas.push({ label: "Depósitos >90%", n: d.alertas.depositos_llenos, to: "/bodega", level: "amarillo" });
  }
  if (d.operaciones.atrasados.length > 0)
    alertas.push({ label: "Trabajos atrasados", n: d.operaciones.atrasados.length, to: "/trabajos", level: "rojo" });
  if (d.operaciones.incidencias > 0)
    alertas.push({ label: "Incidencias abiertas", n: d.operaciones.incidencias, to: "/trabajos", level: "rojo" });

  alertas.sort((a, b) => (a.level === "rojo" ? -1 : 1) - (b.level === "rojo" ? -1 : 1));

  if (alertas.length === 0) {
    return (
      <div className="scada-panel p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
        <CheckCircle2 className="size-4 sm:size-5 text-state-empty shrink-0" />
        <div className="text-xs sm:text-sm text-muted-foreground">Sin alertas críticas. Todo en orden.</div>
      </div>
    );
  }

  return (
    <div className="scada-panel p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <AlertTriangle className="size-4 text-state-incidencia" />
        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          Alertas prioritarias
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {alertas.map((a, i) => (
          <Link
            key={i}
            to={a.to}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors ${
              a.level === "rojo"
                ? "bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/15"
                : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/15"
            }`}
          >
            <span className="tabular-nums font-semibold">{a.n}</span>
            <span>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickActions({ isOperario }: { isOperario: boolean }) {
  const actions: Array<{ to: string; label: string; icon: any; admin?: boolean }> = [
    { to: "/bodega", label: "Movimiento", icon: Droplets },
    { to: "/trabajos", label: "Trabajo", icon: Hammer },
    { to: "/almacen", label: "Lote", icon: FlaskConical, admin: true },
    { to: "/contratos", label: "Contrato", icon: FileText, admin: true },
    { to: "/posicion-comercial", label: "P. comercial", icon: BarChart3, admin: true },
    { to: "/bodega", label: "Bodega", icon: Boxes },
  ];
  const filtered = actions.filter((a) => !a.admin || !isOperario);
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {filtered.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={`${a.to}-${a.label}`}
            to={a.to}
            className="scada-panel p-3 flex flex-col items-center justify-center gap-1.5 text-center hover:border-accent/50 transition-colors min-h-[68px]"
          >
            <Icon className="size-4 sm:size-5 text-accent" />
            <span className="text-[10px] sm:text-xs font-medium leading-tight">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
