import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  getResumenOrden,
  marcarPendienteConfirmacion,
  aplicarExcepcionLaboratorio,
  confirmarOrdenLogistica,
} from "@/lib/api/ordenes-logisticas.functions";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ordenId: string;
}

export function ResumenConfirmacionDialog({ open, onOpenChange, ordenId }: Props) {
  const qc = useQueryClient();
  const getResumen = useServerFn(getResumenOrden);
  const marcar = useServerFn(marcarPendienteConfirmacion);
  const excepcion = useServerFn(aplicarExcepcionLaboratorio);
  const [showExcepcion, setShowExcepcion] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [obs, setObs] = React.useState("");

  const q = useQuery({
    queryKey: ["orden-resumen", ordenId],
    queryFn: () => getResumen({ data: { id: ordenId } }),
    enabled: open,
  });

  const confirmar = useMutation({
    mutationFn: () => marcar({ data: { id: ordenId } }),
    onSuccess: () => {
      toast.success("Orden pasada a pendiente de confirmación. La confirmación final que impacta stock se habilitará en el Bloque B.");
      qc.invalidateQueries({ queryKey: ["orden-log", ordenId] });
      qc.invalidateQueries({ queryKey: ["orden-resumen", ordenId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo cerrar la orden"),
  });

  const aplicarExc = useMutation({
    mutationFn: () => excepcion({ data: { id: ordenId, motivo, observaciones: obs || null } }),
    onSuccess: () => {
      toast.success("Excepción de laboratorio registrada");
      setShowExcepcion(false); setMotivo(""); setObs("");
      qc.invalidateQueries({ queryKey: ["orden-resumen", ordenId] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo aplicar la excepción"),
  });

  const val = q.data?.validation;
  const contrato = q.data?.contrato;
  const orden = val?.orden;
  const errors = val?.errors ?? [];
  const critics = errors.filter((e: any) => e.critico);
  const ok = val?.ok ?? false;
  const isCarga = orden?.tipo === "carga";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Finalizar {isCarga ? "carga" : "descarga"} · resumen operativo
          </DialogTitle>
        </DialogHeader>

        {q.isLoading && <div className="text-muted-foreground py-6">Validando orden…</div>}

        {val && (
          <div className="space-y-4">
            {/* Estado de validación */}
            {ok ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 rounded-md p-3">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span className="text-sm">Todas las validaciones críticas conformes.</span>
              </div>
            ) : (
              <div className="bg-destructive/10 border border-destructive/40 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-destructive" />
                  <span className="text-sm font-medium">Se detectaron {critics.length} incidencia(s) que bloquean el cierre</span>
                </div>
                <ul className="text-xs space-y-1 pl-6 list-disc">
                  {errors.map((e: any, i: number) => (
                    <li key={i} className={e.critico ? "text-destructive" : "text-muted-foreground"}>
                      <Badge variant="outline" className="mr-2 text-[10px]">{e.bloque}</Badge>
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resumen operativo */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Tipo" value={isCarga ? "Carga (salida)" : "Descarga (entrada)"} />
              <Field label="Proceso" value={orden.proceso_codigo_snapshot ?? "—"} />
              <Field label="Producto" value={orden.producto_id ?? "—"} />
              <Field label="Lote" value={orden.lote_id ?? "—"} />
              <Field label={isCarga ? "Depósito origen" : "Depósito destino"} value={(isCarga ? orden.deposito_origen_id : orden.deposito_destino_id) ?? "—"} />
              <Field label="Litros reales" value={val.resumen.totalReal} />
              <Field label="Existencias actuales" value={val.resumen.existenciasActuales ?? "—"} />
              {!isCarga && <Field label="Capacidad depósito" value={val.resumen.capacidadDeposito ?? "—"} />}
              <Field label="Conductor" value={orden.conductor_nombre ?? "—"} />
              <Field label="Matrícula" value={orden.matricula ?? "—"} />
              <Field label="Precinto" value={orden.numero_precinto ?? "—"} />
              <Field label="Laboratorio" value={orden.lab_estado} />
            </div>

            {/* Contrato */}
            {contrato && (
              <div className="border border-border rounded-md p-3 text-sm">
                <div className="font-medium mb-1">Contrato {isCarga ? "de venta" : "de compra"}: {contrato.numero_contrato}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>Contratados: <b>{contrato.litros_contratados} L</b></div>
                  <div>{isCarga ? "Servidos" : "Retirados"}: <b>{isCarga ? contrato.litros_servidos : contrato.litros_retirados} L</b></div>
                  <div>Pendientes actuales: <b>{contrato.litros_pendientes} L</b></div>
                  <div>Pendientes tras cierre: <b>{Number(contrato.litros_pendientes ?? 0) - Number(val.resumen.totalReal ?? 0)} L</b></div>
                  <div>Estado: <b>{contrato.estado}</b></div>
                </div>
              </div>
            )}

            {/* Excepción de laboratorio */}
            {critics.some((e: any) => e.code === "analiticas_pendientes") && (
              <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="size-4 text-amber-400" />
                  <span className="text-sm font-medium">Excepción de laboratorio</span>
                </div>
                {orden.lab_excepcion ? (
                  <div className="text-xs text-muted-foreground">
                    Registrada por {orden.lab_excepcion.autorizado_por} el {new Date(orden.lab_excepcion.autorizado_at).toLocaleString("es-ES")} · Motivo: {orden.lab_excepcion.motivo}
                  </div>
                ) : !showExcepcion ? (
                  <Button size="sm" variant="outline" onClick={() => setShowExcepcion(true)}>Autorizar excepción</Button>
                ) : (
                  <div className="space-y-2">
                    <Textarea placeholder="Motivo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <Textarea placeholder="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => aplicarExc.mutate()} disabled={motivo.length < 3 || aplicarExc.isPending}>Registrar excepción</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowExcepcion(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Volver a editar</Button>
          <Button onClick={() => confirmar.mutate()} disabled={!ok || confirmar.isPending}>
            Confirmar {isCarga ? "carga" : "descarga"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}
