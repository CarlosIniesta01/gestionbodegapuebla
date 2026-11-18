import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserMinus, Play, Check, CircleAlert, Star, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  listMiembrosBodega, listTrabajadoresTrabajo, asignarTrabajadores, actualizarParticipacion,
  retirarTrabajador, cambiarResponsable, responderAsignacion, puedeAsignar,
} from "@/lib/api/trabajadores.functions";
import { ASIG_ESTADO_LABEL, requiereNuevoResponsable } from "@/lib/asignaciones";
import { supabase } from "@/integrations/supabase/client";

const TONE: Record<string, string> = {
  asignado: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  aceptado: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  en_proceso: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  finalizado: "bg-muted text-muted-foreground border-border",
  ausente: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  rechazado: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  retirado: "bg-muted text-muted-foreground border-border",
};

const btn = "text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary flex items-center gap-1";

export function TrabajadoresTab({ bodegaId, trabajoId }: { bodegaId: string; trabajoId: string }) {
  const qc = useQueryClient();
  const listMembros = useServerFn(listMiembrosBodega);
  const listTrabajadores = useServerFn(listTrabajadoresTrabajo);
  const asignarFn = useServerFn(asignarTrabajadores);
  const actualizarFn = useServerFn(actualizarParticipacion);
  const retirarFn = useServerFn(retirarTrabajador);
  const respFn = useServerFn(cambiarResponsable);
  const responderFn = useServerFn(responderAsignacion);
  const permFn = useServerFn(puedeAsignar);

  const meQ = useQuery({ queryKey: ["me-uid"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const permQ = useQuery({ queryKey: ["puede-asignar", bodegaId], queryFn: () => permFn({ data: { bodegaId } }) });
  const gestor = permQ.data === true;
  const membrosQ = useQuery({ queryKey: ["miembros-bodega", bodegaId], queryFn: () => listMembros({ data: { bodegaId } }), enabled: gestor });
  const trabsQ = useQuery({ queryKey: ["trabajadores-trabajo", trabajoId], queryFn: () => listTrabajadores({ data: { bodegaId, trabajoId } }) });

  const miembros = (membrosQ.data ?? []) as any[];
  const todos = (trabsQ.data ?? []) as any[];
  const activos = todos.filter((p) => p.activa !== false);
  const historial = todos.filter((p) => p.activa === false);
  const activosIds = new Set(activos.filter((p) => p.estado_participacion !== "rechazado").map((p) => p.trabajador_id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["trabajadores-trabajo", trabajoId] });
    qc.invalidateQueries({ queryKey: ["distribucion"] });
    qc.invalidateQueries({ queryKey: ["mis-trabajos"] });
  };
  const run = (f: () => Promise<unknown>, ok: string) => f().then(() => { toast.success(ok); invalidate(); }).catch((e) => toast.error(e.message));
  const actualizar = useMutation({ mutationFn: (p: any) => actualizarFn({ data: { bodegaId, ...p } }), onSuccess: () => { toast.success("Actualizado"); invalidate(); }, onError: (e: any) => toast.error(e.message) });

  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [rechazando, setRechazando] = useState<string | null>(null);

  function retirar(p: any) {
    const m = prompt("Motivo de la retirada (opcional):") ?? undefined;
    let nuevo: string | null = null;
    if (requiereNuevoResponsable(activos, p.id)) {
      const otros = activos.filter((x) => x.id !== p.id);
      const idx = prompt(`Elige el nuevo responsable:\n${otros.map((o, i) => `${i + 1}. ${o.profile?.nombre || o.profile?.email}`).join("\n")}`);
      const o = otros[Number(idx) - 1];
      if (!o) { toast.error("Debes elegir un nuevo responsable"); return; }
      nuevo = o.trabajador_id;
    }
    run(() => retirarFn({ data: { bodegaId, id: p.id, motivo: m || undefined, nuevoResponsableId: nuevo } }), "Retirado de la asignación");
  }

  const nombre = (p: any) => p.profile?.nombre || p.profile?.email || p.trabajador_id.slice(0, 8);

  return (
    <div className="space-y-4">
      <section>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Asignados ({activos.length})</div>
        {activos.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 rounded-lg border border-dashed border-border text-center">Sin asignar.</div>
        ) : (
          <div className="space-y-2">
            {activos.map((p) => {
              const propio = p.trabajador_id === meQ.data;
              return (
                <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-1.5">
                        {nombre(p)}
                        {p.es_responsable && <span className="text-[10px] px-1.5 rounded border border-primary text-primary flex items-center gap-0.5"><Star className="size-3" />Responsable</span>}
                      </div>
                      {p.motivo_rechazo && <div className="text-[11px] text-rose-600">Motivo: {p.motivo_rechazo}</div>}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${TONE[p.estado_participacion] ?? TONE.asignado}`}>{ASIG_ESTADO_LABEL[p.estado_participacion] ?? p.estado_participacion}</span>
                  </div>

                  {propio && p.estado_participacion === "asignado" && (
                    rechazando === p.id ? (
                      <div className="flex gap-1.5">
                        <input className="flex-1 text-xs bg-background border border-input rounded px-2 py-1" placeholder="Motivo del rechazo *"
                          value={motivo[p.id] ?? ""} onChange={(e) => setMotivo((s) => ({ ...s, [p.id]: e.target.value }))} />
                        <button className={btn} onClick={() => run(() => responderFn({ data: { id: p.id, aceptar: false, motivo: motivo[p.id] } }), "Asignación rechazada").then(() => setRechazando(null))}>Enviar</button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button className={`${btn} text-emerald-600`} onClick={() => run(() => responderFn({ data: { id: p.id, aceptar: true } }), "Asignación aceptada")}><ThumbsUp className="size-3" />Aceptar</button>
                        <button className={`${btn} text-rose-600`} onClick={() => setRechazando(p.id)}><ThumbsDown className="size-3" />Rechazar</button>
                      </div>
                    )
                  )}

                  {gestor && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!p.es_responsable && p.estado_participacion !== "rechazado" && (
                        <button className={btn} onClick={() => run(() => respFn({ data: { bodegaId, trabajoId, trabajadorId: p.trabajador_id } }), "Responsable actualizado")}><Star className="size-3" />Hacer responsable</button>
                      )}
                      {p.estado_participacion === "rechazado" && (
                        <button className={btn} onClick={() => run(() => asignarFn({ data: { bodegaId, trabajoId, trabajadores: [p.trabajador_id] } }), "Reasignado")}><RotateCcw className="size-3" />Reasignar</button>
                      )}
                      {/* Controles previos a B1, conservados sin ampliar */}
                      {["asignado", "aceptado"].includes(p.estado_participacion) && (
                        <button className={btn} onClick={() => actualizar.mutate({ id: p.id, estado: "en_proceso" })}><Play className="size-3" />Iniciar</button>
                      )}
                      {p.estado_participacion === "en_proceso" && (
                        <button className={btn} onClick={() => actualizar.mutate({ id: p.id, estado: "finalizado", confirmar: true })}><Check className="size-3" />Marcar finalizado</button>
                      )}
                      {p.estado_participacion !== "ausente" && p.estado_participacion !== "rechazado" && (
                        <button className={btn} onClick={() => actualizar.mutate({ id: p.id, estado: "ausente" })}><CircleAlert className="size-3" />Ausente</button>
                      )}
                      <button className={`${btn} text-rose-500 ml-auto`} onClick={() => retirar(p)}><UserMinus className="size-3" />Retirar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {gestor && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Añadir operarios del centro</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {miembros.filter((m) => !activosIds.has(m.user_id)).map((m) => (
              <button key={m.user_id} className={`${btn} justify-between`}
                onClick={() => run(() => asignarFn({ data: { bodegaId, trabajoId, trabajadores: [m.user_id] } }), "Operario asignado")}>
                <span className="truncate">{m.profile?.nombre || m.profile?.email}</span>
                <span className="text-muted-foreground">{m.role?.nombre}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {historial.length > 0 && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Historial de asignaciones</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {historial.map((p) => (
              <li key={p.id}>{nombre(p)} · Retirado{p.retirado_at ? ` el ${new Date(p.retirado_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}` : ""}{p.motivo_retiro ? ` · ${p.motivo_retiro}` : ""}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
