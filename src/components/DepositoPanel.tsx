import { AnimatePresence, motion } from "framer-motion";
import { X, Activity, MessageSquare, ListTodo, Droplets, History, Pencil, Beaker, Sparkles, ArrowRightLeft } from "lucide-react";
import { type Deposito } from "@/lib/bodega-data";
import { useColorSettings } from "@/lib/use-color-settings";
import { useEffect, useState } from "react";


export type QuickAction = "trasiego" | "limpieza" | "producto" | "historial";

interface Props {
  deposito: Deposito | null;
  onClose: () => void;
  onEdit?: () => void;
  onQuickAction?: (action: QuickAction) => void;
  zonaName?: string;
}

export function DepositoPanel({ deposito, onClose, onEdit, onQuickAction, zonaName }: Props) {
  const [isMobile, setIsMobile] = useState(false);


  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

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
            initial={isMobile ? { y: "100%" } : { x: "100%" }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className={
              isMobile
                ? "fixed left-0 right-0 bottom-0 z-50 max-h-[88vh] bg-surface border-t border-border rounded-t-2xl flex flex-col"
                : "fixed top-0 right-0 bottom-0 z-50 w-[420px] bg-surface border-l border-border flex flex-col"
            }
          >
            <Content deposito={deposito} onClose={onClose} onEdit={onEdit} onQuickAction={onQuickAction} isMobile={isMobile} zonaName={zonaName} />

          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Content({ deposito, onClose, onEdit, onQuickAction, isMobile, zonaName }: { deposito: Deposito; onClose: () => void; onEdit?: () => void; onQuickAction?: (action: QuickAction) => void; isMobile: boolean; zonaName?: string }) {

  const colors = useColorSettings();
  const meta = colors.getEstadoMeta(deposito.estado);

  const pct = Math.round((deposito.litros / Math.max(1, deposito.capacidad)) * 100);

  return (
    <>
      {isMobile && (
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
        </div>
      )}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="size-11 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in oklab, ${meta.color} 20%, transparent)`, border: `1px solid ${meta.color}` }}
          >
            <Droplets className="size-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">{deposito.codigo}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{zonaName ?? "Sin zona"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button onClick={onEdit} className="size-9 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Editar depósito">
              <Pencil className="size-4" />
            </button>
          )}
          <button onClick={onClose} className="size-9 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
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
              {deposito.contenido ?? "Sin contenido"}
            </div>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <motion.div
              key={deposito.id + pct}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
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
            {([
              { label: "Iniciar trasiego", icon: ArrowRightLeft, action: "trasiego" as const },
              { label: "Iniciar limpieza", icon: Sparkles, action: "limpieza" as const },
              { label: "Añadir producto", icon: Beaker, action: "producto" as const },
              { label: "Ver historial", icon: History, action: "historial" as const },
            ]).map((a) => (
              <button
                key={a.label}
                onClick={() => onQuickAction?.(a.action)}
                className="px-3 py-2.5 rounded-lg bg-secondary hover:bg-secondary/70 text-sm text-left transition-colors border border-border flex items-center gap-2"
              >
                <a.icon className="size-3.5 text-muted-foreground" />
                {a.label}
              </button>
            ))}
          </div>
        </Section>


        <Section icon={ListTodo} title="Procesos abiertos">
          <div className="text-sm text-muted-foreground">Sin procesos activos en este depósito</div>
        </Section>

        <Section icon={MessageSquare} title="Chat del depósito">
          <div className="text-sm text-muted-foreground">Aún no hay mensajes</div>
        </Section>
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
