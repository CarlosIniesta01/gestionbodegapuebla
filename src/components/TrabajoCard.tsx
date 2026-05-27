import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Clock, ArrowRight, Play, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TIPO_META, ESTADO_LABEL, PRIORIDAD_LABEL, type TrabajoTipo } from "@/lib/trabajo-meta";
import { updateTrabajoEstado, deleteTrabajo } from "@/lib/api/trabajos.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Trabajo {
  id: string;
  tipo: TrabajoTipo;
  titulo: string;
  descripcion?: string | null;
  estado: string;
  prioridad: string;
  deposito_origen?: string | null;
  deposito_destino?: string | null;
  scheduled_at?: string | null;
  created_at: string;
  datos: Record<string, unknown>;
}

export function TrabajoCard({ t, compact }: { t: Trabajo; compact?: boolean }) {
  const meta = TIPO_META[t.tipo];
  const Icon = meta.icon;
  const estado = ESTADO_LABEL[t.estado] ?? ESTADO_LABEL.pendiente;
  const prio = PRIORIDAD_LABEL[t.prioridad];

  const qc = useQueryClient();
  const updFn = useServerFn(updateTrabajoEstado);
  const delFn = useServerFn(deleteTrabajo);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["trabajos"] });
    qc.invalidateQueries({ queryKey: ["actividad"] });
  };
  const upd = useMutation({ mutationFn: updFn, onSuccess: () => { toast.success("Actualizado"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const del = useMutation({ mutationFn: delFn, onSuccess: () => { toast.success("Eliminado"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });

  const dataEntries = Object.entries(t.datos ?? {}).filter(([, v]) => v !== "" && v != null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="scada-panel p-4 group hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="size-11 shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${meta.color} 40%, transparent)` }}>
          <Icon className="size-5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{t.titulo}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{meta.label}</div>
            </div>
            <Badge variant="outline" className={`shrink-0 ${estado.tone}`}>{estado.label}</Badge>
          </div>

          {(t.deposito_origen || t.deposito_destino) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              {t.deposito_origen && <span className="px-1.5 py-0.5 rounded bg-muted">{t.deposito_origen}</span>}
              {t.deposito_origen && t.deposito_destino && <ArrowRight className="size-3" />}
              {t.deposito_destino && <span className="px-1.5 py-0.5 rounded bg-muted">{t.deposito_destino}</span>}
            </div>
          )}

          {!compact && dataEntries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {dataEntries.slice(0, 6).map(([k, v]) => (
                <span key={k}><span className="opacity-70">{k}:</span> <span className="text-foreground">{String(v)}</span></span>
              ))}
            </div>
          )}

          {t.descripcion && !compact && (
            <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{t.descripcion}</div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {t.scheduled_at ? new Date(t.scheduled_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : new Date(t.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              {t.prioridad !== "normal" && <span className={prio.tone}>· {prio.label}</span>}
            </div>
            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
              {t.estado === "pendiente" && (
                <Button size="sm" variant="ghost" onClick={() => upd.mutate({ data: { id: t.id, estado: "en_curso" }})}>
                  <Play className="size-3.5 mr-1" />Iniciar
                </Button>
              )}
              {(t.estado === "pendiente" || t.estado === "en_curso") && (
                <Button size="sm" variant="ghost" onClick={() => upd.mutate({ data: { id: t.id, estado: "completado" }})}>
                  <Check className="size-3.5 mr-1" />Completar
                </Button>
              )}
              {t.estado !== "cancelado" && t.estado !== "completado" && (
                <Button size="sm" variant="ghost" onClick={() => upd.mutate({ data: { id: t.id, estado: "cancelado" }})}>
                  <X className="size-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("¿Eliminar trabajo?")) del.mutate({ data: { id: t.id }}); }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
