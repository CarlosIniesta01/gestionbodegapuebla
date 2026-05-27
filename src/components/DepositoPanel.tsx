import { AnimatePresence, motion } from "framer-motion";
import { X, Activity, MessageSquare, ListTodo, Droplets, History } from "lucide-react";
import { ESTADO_META, type Deposito } from "@/lib/bodega-data";

interface Props {
  deposito: Deposito | null;
  onClose: () => void;
}

export function DepositoPanel({ deposito, onClose }: Props) {
  return (
    <AnimatePresence>
      {deposito && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-surface border-l border-border flex flex-col"
          >
            <PanelContent deposito={deposito} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PanelContent({ deposito, onClose }: { deposito: Deposito; onClose: () => void }) {
  const meta = ESTADO_META[deposito.estado];
  const pct = Math.round((deposito.litros / deposito.capacidad) * 100);

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="size-11 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in oklab, ${meta.color} 20%, transparent)`, border: `1px solid ${meta.color}` }}
          >
            <Droplets className="size-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">{deposito.id}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{deposito.zona.replace("-", " ")}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-9 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div
          className="rounded-xl p-4 border"
          style={{
            background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
            borderColor: `color-mix(in oklab, ${meta.color} 40%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Estado</span>
            <span className="text-sm font-medium" style={{ color: meta.color }}>{meta.label}</span>
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-3xl font-display font-semibold tracking-tight">
                {deposito.litros.toLocaleString("es-ES")}
                <span className="text-base text-muted-foreground ml-1">L</span>
              </div>
              <div className="text-xs text-muted-foreground">
                de {deposito.capacidad.toLocaleString("es-ES")} L · {pct}%
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {deposito.variedad ?? "Sin contenido"}
            </div>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: meta.color }}
            />
          </div>
        </div>

        <Section icon={History} title="Último movimiento">
          <div className="text-sm">{deposito.ultimoMovimiento ?? "Sin movimientos recientes"}</div>
        </Section>

        <Section icon={Activity} title="Acciones rápidas">
          <div className="grid grid-cols-2 gap-2">
            {["Trasiego", "Limpieza", "Añadir producto", "Incidencia"].map((a) => (
              <button
                key={a}
                className="px-3 py-2.5 rounded-lg bg-secondary hover:bg-secondary/70 text-sm text-left transition-colors border border-border"
              >
                {a}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={ListTodo} title="Tareas activas">
          <div className="text-sm text-muted-foreground">Sin tareas asignadas</div>
        </Section>

        <Section icon={MessageSquare} title="Chat del depósito">
          <div className="text-sm text-muted-foreground">Aún no hay mensajes</div>
        </Section>
      </div>

      <div className="p-4 border-t border-border">
        <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg transition-colors">
          Iniciar trabajo
        </button>
      </div>
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}
