import { motion } from "framer-motion";
import { ArrowRight, Droplets, Grape, Sparkles, Package, Beaker } from "lucide-react";
import { PROCESOS_ACTIVOS } from "@/lib/bodega-data";

const ICONS = {
  trasiego: Droplets,
  limpieza: Sparkles,
  vendimia: Grape,
  embotellado: Package,
  producto: Beaker,
} as const;

const LABELS = {
  trasiego: "Trasiego",
  limpieza: "Limpieza",
  vendimia: "Vendimia",
  embotellado: "Embotellado",
  producto: "Producto enológico",
} as const;

export function ProcessTicker() {
  return (
    <div className="scada-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Procesos abiertos</div>
          <div className="font-display font-semibold">{PROCESOS_ACTIVOS.length} en curso</div>
        </div>
        <button className="text-xs text-accent hover:underline">Ver todo</button>
      </div>
      <div className="p-2 space-y-1.5 max-h-[420px] overflow-y-auto">
        {PROCESOS_ACTIVOS.map((p, idx) => {
          const Icon = ICONS[p.tipo];
          const o = p.origen_codigo;
          const d = p.destino_codigo;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50"
            >
              <div className="size-9 rounded-lg bg-state-trasiego/15 border border-state-trasiego/40 flex items-center justify-center shrink-0">
                <Icon className="size-4 text-state-trasiego" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  {LABELS[p.tipo]}
                  {o && d && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-mono">
                      {o} <ArrowRight className="size-3" /> {d}
                    </span>
                  )}
                  {!o && d && (
                    <span className="text-muted-foreground text-xs font-mono">→ {d}</span>
                  )}
                  {o && !d && (
                    <span className="text-muted-foreground text-xs font-mono">{o}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.operario} · {p.iniciado}{p.litros ? ` · ${p.litros.toLocaleString("es-ES")} L` : ""}
                </div>
              </div>
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inset-0 rounded-full bg-state-fermentacion animate-ping opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-state-fermentacion" />
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
