import { AnimatePresence, motion } from "framer-motion";
import { X, Activity, MessageSquare, ListTodo, Droplets, History, Pencil, Beaker, Sparkles, ArrowRightLeft } from "lucide-react";
import { type Deposito } from "@/lib/bodega-data";
import { useColorSettings } from "@/lib/use-color-settings";
import { useEffect, useState } from "react";


export type QuickAction = "trasiego" | "limpieza" | "producto" | "historial";

export interface DepositoExistencia {
  litros: number;
  alcohol_absoluto: number;
  grado_medio: number;
  lineas: { producto_id: string | null; nombre: string; litros: number; grado: number; aa: number }[];
}

interface Props {
  deposito: Deposito | null;
  existencia?: DepositoExistencia | null;
  onClose: () => void;
  onEdit?: () => void;
  onQuickAction?: (action: QuickAction) => void;
  zonaName?: string;
}

export function DepositoPanel({ deposito, existencia, onClose, onEdit, onQuickAction, zonaName }: Props) {
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
            className="fixed inset-0 bg-foreground/15 backdrop-blur-[2px] z-40"
          />
          <motion.aside
            initial={isMobile ? { y: "100%" } : { x: "100%" }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className={
              isMobile
                ? "fixed left-0 right-0 bottom-0 z-50 max-h-[88vh] bg-card border-t border-border rounded-t-2xl flex flex-col shadow-2xl"
                : "fixed top-0 right-0 bottom-0 z-50 w-[420px] bg-card border-l border-border flex flex-col shadow-[-8px_0_24px_-12px_rgba(15,23,42,0.12)]"
            }
          >
            <Content deposito={deposito} existencia={existencia ?? null} onClose={onClose} onEdit={onEdit} onQuickAction={onQuickAction} isMobile={isMobile} zonaName={zonaName} />

          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Content({ deposito, existencia, onClose, onEdit, onQuickAction, isMobile, zonaName }: { deposito: Deposito; existencia: DepositoExistencia | null; onClose: () => void; onEdit?: () => void; onQuickAction?: (action: QuickAction) => void; isMobile: boolean; zonaName?: string }) {

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
          className="rounded-xl p-4 border bg-surface"
          style={{
            borderColor: `color-mix(in oklab, ${meta.color} 25%, var(--border))`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Estado</span>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                color: meta.color,
                background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
                border: `1px solid color-mix(in oklab, ${meta.color} 30%, transparent)`,
              }}
            >
              {meta.label}
            </span>
          </div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-3xl font-display font-semibold tracking-tight tabular-nums">
                {deposito.litros.toLocaleString("es-ES")}
                <span className="text-base text-muted-foreground ml-1 font-normal">L</span>
              </div>
              <div className="text-xs text-muted-foreground">
                de {deposito.capacidad.toLocaleString("es-ES")} L · {pct}%
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground max-w-[55%] truncate">
              {deposito.contenido ?? "Sin contenido"}
            </div>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
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

        <Section icon={Droplets} title="Existencias actuales">
          {existencia && existencia.lineas.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Litros</div>
                  <div className="font-semibold tabular-nums">{existencia.litros.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grado medio</div>
                  <div className="font-semibold tabular-nums">{existencia.grado_medio.toFixed(2)}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Alc. absoluto</div>
                  <div className="font-semibold tabular-nums">{existencia.alcohol_absoluto.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</div>
                </div>
              </div>
              {existencia.lineas.length > 1 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="text-left p-1.5">Producto</th><th className="text-right p-1.5">L</th><th className="text-right p-1.5">°</th><th className="text-right p-1.5">AA</th></tr>
                    </thead>
                    <tbody>
                      {existencia.lineas.map((l, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-1.5">{l.nombre}</td>
                          <td className="p-1.5 text-right tabular-nums">{l.litros.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                          <td className="p-1.5 text-right tabular-nums">{l.grado.toFixed(2)}</td>
                          <td className="p-1.5 text-right tabular-nums">{l.aa.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sin existencias registradas</div>
          )}
        </Section>

        <Section icon={Sparkles} title="Próxima acción recomendada">
          <RecomendacionDeposito deposito={deposito} pct={pct} />
        </Section>

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

function RecomendacionDeposito({ deposito, pct }: { deposito: Deposito; pct: number }) {
  const litros = Number(deposito.litros) || 0;
  const items: { tone: "ok" | "warn" | "danger" | "info"; text: string }[] = [];
  if (litros <= 0.01) {
    items.push({ tone: "ok", text: "Vacío y disponible para una nueva entrada." });
  } else if (pct >= 95) {
    items.push({ tone: "warn", text: "Cerca del 95% de capacidad: evita nuevas entradas." });
  }
  if (deposito.estado === "limpieza") {
    items.push({ tone: "info", text: "En limpieza: finalizar antes de admitir producto." });
  }
  if (!items.length) {
    items.push({ tone: "info", text: "Sin acciones críticas pendientes." });
  }
  const TONE: Record<string, string> = {
    ok: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
    warn: "bg-amber-500/10 border-amber-500/30 text-amber-700",
    danger: "bg-rose-500/10 border-rose-500/30 text-rose-700",
    info: "bg-sky-500/10 border-sky-500/30 text-sky-700",
  };
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className={`text-xs px-2.5 py-2 rounded-md border ${TONE[it.tone]}`}>{it.text}</div>
      ))}
    </div>
  );
}

