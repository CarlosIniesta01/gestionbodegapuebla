import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Grape, Beaker, Sparkles, Package, AlertTriangle, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/trabajos")({
  head: () => ({ meta: [{ title: "Trabajos · Vinea Control" }] }),
  component: Trabajos,
});

const TIPOS = [
  { id: "trasiego", label: "Trasiego", icon: Droplets, color: "var(--state-trasiego)" },
  { id: "vendimia", label: "Depósitos Vendimia", icon: Grape, color: "var(--state-fermentacion)" },
  { id: "producto", label: "Producto Enológico", icon: Beaker, color: "var(--accent)" },
  { id: "limpieza", label: "Limpieza", icon: Sparkles, color: "var(--state-limpieza)" },
  { id: "embotellado", label: "Embotellado", icon: Package, color: "var(--state-vino)" },
  { id: "incidencia", label: "Incidencia", icon: AlertTriangle, color: "var(--state-incidencia)" },
  { id: "observacion", label: "Observación", icon: MessageSquare, color: "var(--muted-foreground)" },
];

function Trabajos() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6 md:mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Nuevo trabajo</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">¿Qué vas a registrar?</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {TIPOS.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -2 }}
              className="aspect-square scada-panel flex flex-col items-center justify-center gap-3 p-4 group transition-all hover:border-accent/60"
            >
              <div
                className="size-14 md:size-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{
                  background: `color-mix(in oklab, ${t.color} 18%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${t.color} 50%, transparent)`,
                  boxShadow: `0 0 24px color-mix(in oklab, ${t.color} 25%, transparent)`,
                }}
              >
                <Icon className="size-7" style={{ color: t.color }} />
              </div>
              <div className="text-sm font-medium text-center leading-tight">{t.label}</div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
