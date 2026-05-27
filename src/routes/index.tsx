import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Droplets, AlertTriangle, Activity, Map } from "lucide-react";
import { ProcessTicker } from "@/components/ProcessTicker";
import { StatCard } from "@/components/StatCard";
import { DEPOSITOS_INICIALES, ESTADO_META } from "@/lib/bodega-data";
import { useBodegaMap } from "@/lib/use-bodega-map";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio · Vinea Control" },
      { name: "description", content: "Vista operativa en tiempo real de la bodega." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { depositos, zonas, hydrated } = useBodegaMap();
  const list = hydrated ? depositos : DEPOSITOS_INICIALES;

  const totalLitros = list.reduce((s, d) => s + d.litros, 0);
  const capacidad = list.reduce((s, d) => s + d.capacidad, 0);
  const ocupacion = capacidad > 0 ? Math.round((totalLitros / capacidad) * 100) : 0;
  const incidencias = list.filter((d) => d.estado === "incidencia").length;
  const fermentando = list.filter((d) => d.estado === "fermentacion").length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Centro de control · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">
            Buenos días, <span className="text-accent">enólogo</span>
          </h1>
        </div>
        <Link
          to="/bodega"
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <Map className="size-4" /> Ir al mapa
        </Link>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Ocupación bodega"
          value={`${ocupacion}%`}
          hint={`${Math.round(totalLitros / 1000)}k / ${Math.round(capacidad / 1000)}k L`}
          icon={Droplets}
          accent="var(--primary)"
        />
        <StatCard
          label="Depósitos activos"
          value={list.filter((d) => d.litros > 0).length}
          hint={`${list.length} totales · ${zonas.length} zonas`}
          icon={Boxes}
          accent="var(--accent)"
        />
        <StatCard
          label="En fermentación"
          value={fermentando}
          hint="Vigilancia activa"
          icon={Activity}
          accent="var(--state-fermentacion)"
        />
        <StatCard
          label="Incidencias"
          value={incidencias}
          hint={incidencias ? "Requieren atención" : "Todo en orden"}
          icon={AlertTriangle}
          accent={incidencias ? "var(--state-incidencia)" : "var(--state-empty)"}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="scada-panel p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Reparto por estado</div>
          <div className="space-y-2">
            {Object.entries(ESTADO_META).map(([k, meta]) => {
              const n = list.filter((d) => d.estado === k).length;
              const pct = list.length ? (n / list.length) * 100 : 0;
              return (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="w-32 text-muted-foreground">{meta.label}</span>
                  <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
        <ProcessTicker />
      </section>
    </div>
  );
}
