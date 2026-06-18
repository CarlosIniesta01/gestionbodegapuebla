import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, UserMinus, Play, Check, Clock, CircleAlert, X } from "lucide-react";
import {
  listMiembrosBodega, listTrabajadoresTrabajo,
  asignarTrabajador, actualizarParticipacion, retirarTrabajador,
} from "@/lib/api/trabajadores.functions";


const ESTADO_META: Record<string, { label: string; color: string }> = {
  asignado:   { label: "Asignado",   color: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
  en_proceso: { label: "En proceso", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  finalizado: { label: "Finalizado", color: "bg-muted text-muted-foreground border-border" },
  ausente:    { label: "Ausente",    color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  rechazado:  { label: "Rechazado",  color: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
};

export function TrabajadoresTab({ bodegaId, trabajoId }: { bodegaId: string; trabajoId: string }) {
  const qc = useQueryClient();
  const listMembros = useServerFn(listMiembrosBodega);
  const listTrabajadores = useServerFn(listTrabajadoresTrabajo);
  const asignarFn = useServerFn(asignarTrabajador);
  const actualizarFn = useServerFn(actualizarParticipacion);
  const retirarFn = useServerFn(retirarTrabajador);

  

  const membrosQ = useQuery({
    queryKey: ["miembros-bodega", bodegaId],
    queryFn: () => listMembros({ data: { bodegaId } }),
  });
  const trabsQ = useQuery({
    queryKey: ["trabajadores-trabajo", trabajoId],
    queryFn: () => listTrabajadores({ data: { bodegaId, trabajoId } }),
  });

  const miembros = (membrosQ.data ?? []) as any[];
  const participantes = (trabsQ.data ?? []) as any[];
  const yaAsignados = new Set(participantes.map((p) => p.trabajador_id));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["trabajadores-trabajo", trabajoId] });

  const asignar = useMutation({
    mutationFn: (uid: string) => asignarFn({ data: { bodegaId, trabajoId, trabajadorId: uid } }),
    onSuccess: () => { toast.success("Trabajador asignado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const actualizar = useMutation({
    mutationFn: (p: any) => actualizarFn({ data: { bodegaId, ...p } }),
    onSuccess: () => { toast.success("Actualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const retirar = useMutation({
    mutationFn: (id: string) => retirarFn({ data: { bodegaId, id } }),
    onSuccess: () => { toast.success("Trabajador retirado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [obs, setObs] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <section>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Participantes ({participantes.length})</div>
        {participantes.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 rounded-lg border border-dashed border-border text-center">
            Aún no hay trabajadores asignados.
          </div>
        ) : (
          <div className="space-y-2">
            {participantes.map((p) => {
              const meta = ESTADO_META[p.estado_participacion] ?? ESTADO_META.asignado;
              const nombre = p.profile?.nombre || p.profile?.email || p.trabajador_id.slice(0, 8);
              return (
                <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{nombre}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {p.hora_inicio && <span><Clock className="inline size-3 mr-0.5" />Inicio {new Date(p.hora_inicio).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>}
                        {p.hora_fin && <span><Check className="inline size-3 mr-0.5" />Fin {new Date(p.hora_fin).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>}
                        {p.confirmado_por_trabajador && <span className="text-emerald-600">✓ Confirmado</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${meta.color}`}>{meta.label}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.estado_participacion === "asignado" && (
                      <button onClick={() => actualizar.mutate({ id: p.id, estado: "en_proceso" })}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary flex items-center gap-1">
                        <Play className="size-3" /> Iniciar
                      </button>
                    )}
                    {p.estado_participacion !== "finalizado" && (
                      <button onClick={() => actualizar.mutate({ id: p.id, estado: "finalizado", confirmar: true })}
                        className="text-[11px] px-2 py-1 rounded border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 flex items-center gap-1">
                        <Check className="size-3" /> Marcar finalizado
                      </button>
                    )}
                    {p.estado_participacion !== "ausente" && (
                      <button onClick={() => actualizar.mutate({ id: p.id, estado: "ausente" })}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary text-muted-foreground flex items-center gap-1">
                        <CircleAlert className="size-3" /> Ausente
                      </button>
                    )}
                    <button onClick={() => { if (confirm("¿Retirar trabajador?")) retirar.mutate(p.id); }}
                      className="text-[11px] px-2 py-1 rounded text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 ml-auto">
                      <UserMinus className="size-3" /> Retirar
                    </button>
                  </div>

                  <div className="flex items-end gap-2">
                    <textarea
                      value={obs[p.id] ?? p.observaciones ?? ""}
                      onChange={(e) => setObs((s) => ({ ...s, [p.id]: e.target.value }))}
                      placeholder="Observaciones…"
                      rows={1}
                      className="flex-1 text-xs bg-background border border-input rounded-lg px-2 py-1"
                    />
                    <button
                      onClick={() => actualizar.mutate({ id: p.id, observaciones: (obs[p.id] ?? p.observaciones ?? "").trim() || null })}
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary"
                    >Guardar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Disponibles para asignar</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {miembros
            .filter((m) => !yaAsignados.has(m.user_id))
            .map((m) => {
              const nombre = m.profile?.nombre || m.profile?.email || m.user_id.slice(0, 8);
              return (
                <button key={m.user_id}
                  onClick={() => asignar.mutate(m.user_id)}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border hover:border-foreground/40 hover:bg-secondary transition-colors text-left">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{nombre}</div>
                    {m.role?.nombre && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.role.nombre}</div>}
                  </div>
                  <UserPlus className="size-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          {miembros.length > 0 && miembros.every((m) => yaAsignados.has(m.user_id)) && (
            <div className="col-span-full text-xs text-muted-foreground text-center p-4">
              Todos los miembros de la bodega ya están asignados.
            </div>
          )}
          {miembros.length === 0 && (
            <div className="col-span-full text-xs text-muted-foreground text-center p-4">Cargando miembros…</div>
          )}
        </div>
      </section>
    </div>
  );
}
