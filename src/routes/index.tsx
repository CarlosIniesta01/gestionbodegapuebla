import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Droplets, AlertTriangle, Activity } from "lucide-react";
import { BodegaMap } from "@/components/BodegaMap";
import { ProcessTicker } from "@/components/ProcessTicker";
import { StatCard } from "@/components/StatCard";
import { DEPOSITOS, PROCESOS_ACTIVOS } from "@/lib/bodega-data";

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
  const totalLitros = DEPOSITOS.reduce((s, d) => s + d.litros, 0);
  const capacidad = DEPOSITOS.reduce((s, d) => s + d.capacidad, 0);
  const ocupacion = Math.round((totalLitros / capacidad) * 100);
  const incidencias = DEPOSITOS.filter((d) => d.estado === "incidencia").length;
  const fermentando = DEPOSITOS.filter((d) => d.estado === "fermentacion").length;

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
        <button className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors">
          + Nuevo trabajo
        </button>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Ocupación bodega"
          value={`${ocupacion}%`}
          hint={`${(totalLitros / 1000).toFixed(0)}k / ${(capacidad / 1000).toFixed(0)}k L`}
          icon={Droplets}
          accent="var(--primary)"
        />
        <StatCard
          label="Depósitos activos"
          value={DEPOSITOS.filter((d) => d.litros > 0).length}
          hint={`${DEPOSITOS.length} totales`}
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

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <BodegaMap />
        <ProcessTicker />
      </section>
    </div>
  );
}
