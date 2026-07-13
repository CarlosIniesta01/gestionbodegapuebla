import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Printer, Pencil, Play, CheckSquare, XCircle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  getOrdenLogistica,
  iniciarOrdenLogistica,
  rechazarOrdenLogistica,
} from "@/lib/api/ordenes-logisticas.functions";
import { DECLARACION_TRANSPORTISTA_TEXTO, ESTADO_META } from "@/lib/ordenes-logisticas-meta";
import { OrdenLogisticaDialog } from "@/components/ordenes/OrdenLogisticaDialog";
import { ResumenConfirmacionDialog } from "@/components/ordenes/ResumenConfirmacionDialog";

export const Route = createFileRoute("/_authenticated/ordenes/$id")({
  head: () => ({ meta: [{ title: "Orden logística · Vinea Control" }] }),
  component: OrdenDetailPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Error: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Orden no encontrada.</div>,
});

function OrdenDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const fn = useServerFn(getOrdenLogistica);
  const iniciar = useServerFn(iniciarOrdenLogistica);
  const rechazar = useServerFn(rechazarOrdenLogistica);
  const [editing, setEditing] = React.useState(false);
  const [showResumen, setShowResumen] = React.useState(false);
  const [showRechazo, setShowRechazo] = React.useState(false);
  const [motivoRechazo, setMotivoRechazo] = React.useState("");

  const q = useQuery({
    queryKey: ["orden-log", id],
    queryFn: () => fn({ data: { id } }),
  });

  const mIniciar = useMutation({
    mutationFn: () => iniciar({ data: { id } }),
    onSuccess: () => { toast.success("Orden iniciada"); qc.invalidateQueries({ queryKey: ["orden-log", id] }); },
    onError: (e: any) => toast.error(e.message ?? "No se pudo iniciar"),
  });
  const mRechazar = useMutation({
    mutationFn: () => rechazar({ data: { id, motivo: motivoRechazo } }),
    onSuccess: () => {
      toast.success("Orden rechazada");
      setShowRechazo(false); setMotivoRechazo("");
      qc.invalidateQueries({ queryKey: ["orden-log", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo rechazar"),
  });

  if (q.isLoading) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  if (!q.data) return <div className="p-6">Orden no encontrada.</div>;

  const o = q.data.orden as any;
  const comps = q.data.compartimentos as any[];
  const parametros = (o.instrucciones?.parametros ?? []) as any[];
  const comprobaciones = (o.comprobaciones ?? []) as any[];
  const estadoMeta = ESTADO_META[o.estado as keyof typeof ESTADO_META];
  const isCarga = o.tipo === "carga";
  const title = isCarga ? "ORDEN DE CARGA" : "ORDEN DE DESCARGA";
  const isBloqueada = ["completada", "cerrada", "rechazada", "cancelada", "rectificada"].includes(o.estado);

  return (
    <div className="max-w-[900px] mx-auto p-4 print:p-0 print:max-w-none">
      {/* NAV (print:hidden) */}
      <div className="print:hidden flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeft className="size-3.5 mr-1" /> Volver
        </Button>
        <div className="flex gap-2 flex-wrap">
          {o.estado === "autorizada" && (
            <Button size="sm" variant="default" onClick={() => mIniciar.mutate()} disabled={mIniciar.isPending}>
              <Play className="size-3.5 mr-1" /> Iniciar
            </Button>
          )}
          {o.estado === "en_proceso" && (
            <Button size="sm" variant="default" onClick={() => setShowResumen(true)}>
              <CheckSquare className="size-3.5 mr-1" /> Finalizar {isCarga ? "carga" : "descarga"}
            </Button>
          )}
          {["autorizada", "en_proceso", "pendiente_confirmacion", "pendiente_laboratorio"].includes(o.estado) && (
            <Button size="sm" variant="outline" onClick={() => setShowRechazo(true)}>
              <XCircle className="size-3.5 mr-1" /> Rechazar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={isBloqueada}>
            <Pencil className="size-3.5 mr-1" /> Editar
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {showRechazo && (
        <div className="print:hidden mb-4 border border-destructive/40 bg-destructive/10 rounded-md p-3 space-y-2">
          <div className="text-sm font-medium">Motivo de rechazo</div>
          <Textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} placeholder="Explica por qué se rechaza esta orden" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => mRechazar.mutate()} disabled={motivoRechazo.length < 3 || mRechazar.isPending}>Confirmar rechazo</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRechazo(false); setMotivoRechazo(""); }}>Cancelar</Button>
          </div>
        </div>
      )}


      {/* PAGE 1 */}
      <div className="print-page bg-white text-black p-8 border" style={{ minHeight: "1123px" }}>
        <header className="flex justify-between items-start border-b border-black pb-2 mb-4">
          <div>
            <div className="text-[10px]">Vinea Control</div>
            <div className="font-bold text-lg">{title}</div>
          </div>
          <div className="text-right text-[11px]">
            <div>Proceso: <b>{o.proceso_codigo_snapshot ?? "—"}</b></div>
            <div>Versión: {o.proceso_version_snapshot ?? "—"}</div>
            <div>Nº operación: <b>{o.numero_operacion ?? "—"}</b></div>
            <div>Fecha: {o.fecha_programada ?? "—"} {o.hora_programada ?? ""}</div>
          </div>
        </header>

        <SectionPrint title="Datos generales">
          <Row label="Matrícula" value={`${o.matricula ?? "—"}${o.remolque_matricula ? " / " + o.remolque_matricula : ""}`} />
          <Row label="Transportista" value={o.empresa_transportista ?? "—"} />
          <Row label="Conductor" value={`${o.conductor_nombre ?? "—"} · ${o.conductor_documento ?? ""}`} />
          <Row label="Teléfono" value={o.conductor_telefono ?? "—"} />
        </SectionPrint>

        {isCarga && comprobaciones.length > 0 && (
          <SectionPrint title="Comprobaciones previas">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-1">#</th>
                  <th className="text-left">Comprobación</th>
                  <th className="text-left w-32">Estado</th>
                  <th className="text-left">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {comprobaciones.map((c, i) => (
                  <tr key={c.key} className="border-b border-gray-300">
                    <td className="py-1">{i + 1}</td>
                    <td>{c.label}</td>
                    <td>{c.estado || "—"}</td>
                    <td>{c.observaciones ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionPrint>
        )}

        {!isCarga && parametros.length > 0 && (
          <SectionPrint title="Analítica de recepción">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-1">Parámetro</th>
                  <th className="text-left w-16">Unidad</th>
                  <th className="text-left w-20">Valor</th>
                  <th className="text-left w-20">Obligat.</th>
                  <th className="text-left w-24">Estado</th>
                </tr>
              </thead>
              <tbody>
                {parametros.map((p, i) => (
                  <tr key={i} className="border-b border-gray-300">
                    <td className="py-1">{p.parametro}</td>
                    <td>{p.unidad ?? ""}</td>
                    <td>{p.valor ?? ""}</td>
                    <td>{p.obligatorio ? "Sí" : "No"}</td>
                    <td>{p.estado ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionPrint>
        )}

        <SectionPrint title={isCarga ? "Producto y origen" : "Producto y destino"}>
          <Row label="Categoría" value={o.categoria ?? "—"} />
          <Row label={isCarga ? "Depósito origen" : "Depósito destino"} value={(isCarga ? o.deposito_origen_id : o.deposito_destino_id) ?? "—"} />
          <Row label="Litros previstos" value={o.litros_previstos ?? "—"} />
          <Row label="Litros reales" value={o.litros_reales ?? "—"} />
          <Row label="Grado" value={o.grado ?? "—"} />
          <Row label="Campaña" value={o.campana ?? "—"} />
        </SectionPrint>

        {comps.length > 0 && (
          <SectionPrint title="Compartimentos">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-1 w-10">Nº</th>
                  <th className="text-left">Depósito</th>
                  <th className="text-left w-20">L. prev.</th>
                  <th className="text-left w-20">L. real</th>
                  <th className="text-left">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.id} className="border-b border-gray-300">
                    <td className="py-1">{c.numero}</td>
                    <td>{c.deposito_id ?? ""}</td>
                    <td>{c.litros_previstos ?? ""}</td>
                    <td>{c.litros_reales ?? ""}</td>
                    <td>{c.observaciones ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionPrint>
        )}

        <SectionPrint title="Instrucciones">
          <Row label="LOT" value={o.instrucciones?.lot ?? "—"} />
          <Row label="CAD" value={o.instrucciones?.cad ?? "—"} />
          <Row label="PROV" value={o.instrucciones?.prov ?? "—"} />
          <Row label="Organoléptico" value={o.instrucciones?.organoleptico ?? "—"} />
          <Row label="Especificaciones" value={o.instrucciones?.especificaciones ?? "—"} />
        </SectionPrint>

        <SectionPrint title="Limpieza y EPIS">
          <Row label="Limpieza" value={o.limpieza_epis?.limpieza ? "Confirmada" : "—"} />
          <Row label="EPIS" value={o.limpieza_epis?.epis ? "Confirmados" : "—"} />
          <Row label="Obs. limpieza" value={o.limpieza_epis?.limpieza_obs ?? ""} />
          <Row label="Obs. EPIS" value={o.limpieza_epis?.epi_obs ?? ""} />
        </SectionPrint>

        <footer className="mt-6 text-[10px] flex justify-between">
          <div>Estado: <b>{estadoMeta?.label}</b></div>
          <div>Página 1 de 2</div>
        </footer>
      </div>

      {/* PAGE 2 */}
      <div className="print-page bg-white text-black p-8 border mt-6 print:mt-0" style={{ minHeight: "1123px", pageBreakBefore: "always" }}>
        <header className="flex justify-between items-start border-b border-black pb-2 mb-4">
          <div>
            <div className="text-[10px]">Vinea Control</div>
            <div className="font-bold text-lg">{title}</div>
          </div>
          <div className="text-right text-[11px]">
            <div>Proceso: <b>{o.proceso_codigo_snapshot ?? "—"}</b></div>
            <div>Nº operación: <b>{o.numero_operacion ?? "—"}</b></div>
            <div>Fecha: {o.fecha_programada ?? "—"}</div>
          </div>
        </header>

        <SectionPrint title="Autorización de laboratorio">
          <Row label="Estado" value={o.lab_estado} />
          <Row label="Cargo" value={o.lab_autorizado_cargo ?? "—"} />
          <Row label="Fecha/hora" value={o.lab_autorizado_at ? new Date(o.lab_autorizado_at).toLocaleString("es-ES") : "—"} />
          <Row label="Observaciones" value={o.lab_observaciones ?? "—"} />
          <div className="h-16 border border-dashed border-black mt-3 flex items-center justify-center text-[10px] text-gray-500">Firma laboratorio</div>
        </SectionPrint>

        <SectionPrint title="Operarios realizadores">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1 w-24">Fecha</th>
                <th className="text-left">Trabajador</th>
                <th className="text-left w-24">Firma</th>
                <th className="text-left w-20">Hora inicio</th>
                <th className="text-left w-20">Hora fin</th>
                <th className="text-left">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-gray-300 h-8"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-gray-500 mt-1">Asignaciones concretas gestionadas desde el trabajo vinculado.</div>
        </SectionPrint>

        <SectionPrint title="Declaración del transportista">
          <div className="text-[11px] leading-relaxed mb-3">{DECLARACION_TRANSPORTISTA_TEXTO}</div>
          <div className="grid grid-cols-2 gap-6 text-[11px]">
            <div>
              <Row label="Nombre conductor" value={o.conductor_nombre ?? "—"} />
              <Row label="Documento" value={o.conductor_documento ?? "—"} />
              <Row label="Nº precinto" value={o.numero_precinto ?? "—"} />
              <Row label="Precintos adicionales" value={o.precintos_adicionales ?? "—"} />
            </div>
            <div>
              <div className="text-[10px] uppercase mb-1">Firma conductor</div>
              <div className="h-24 border border-dashed border-black"></div>
            </div>
          </div>
        </SectionPrint>

        <footer className="mt-6 text-[10px] flex justify-between">
          <div>Estado: <b>{estadoMeta?.label}</b></div>
          <div>Página 2 de 2</div>
        </footer>
      </div>

      <div className="print:hidden mt-4">
        <Badge variant="outline" className={estadoMeta?.tone}>{estadoMeta?.label}</Badge>
      </div>

      {editing && (
        <OrdenLogisticaDialog
          open={editing}
          onOpenChange={setEditing}
          bodegaId={o.bodega_id}
          tipo={o.tipo}
          ordenId={o.id}
        />
      )}

      {showResumen && (
        <ResumenConfirmacionDialog open={showResumen} onOpenChange={setShowResumen} ordenId={o.id} />
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          .print-page { border: none !important; box-shadow: none !important; margin: 0 !important; padding: 20mm !important; }
          nav, aside, header[data-app-shell], .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}

function SectionPrint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="text-[12px] font-bold uppercase border-b border-black mb-1">{title}</h2>
      <div className="text-[11px]">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <div className="w-40 text-[10px] uppercase text-gray-600">{label}</div>
      <div className="flex-1">{value ?? "—"}</div>
    </div>
  );
}
