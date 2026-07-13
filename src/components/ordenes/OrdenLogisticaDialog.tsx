import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Truck, PackageOpen, Printer } from "lucide-react";
import {
  upsertOrdenLogistica,
  getOrdenLogistica,
} from "@/lib/api/ordenes-logisticas.functions";
import { listProcesosDoc } from "@/lib/api/procesos-doc.functions";
import {
  COMPROBACIONES_CARGA_DEFAULT,
  DECLARACION_TRANSPORTISTA_TEXTO,
  ESTADO_META,
  ORDEN_ESTADOS,
  PARAMETROS_DESCARGA_DEFAULT,
  type OrdenTipo,
} from "@/lib/ordenes-logisticas-meta";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { Link } from "@tanstack/react-router";

type Compartimento = {
  numero: number;
  depositoId?: string | null;
  litrosPrevistos?: number | null;
  litrosReales?: number | null;
  observaciones?: string | null;
};

type Comprobacion = {
  key: string;
  label: string;
  estado: "conforme" | "no_conforme" | "no_aplica" | "";
  observaciones?: string;
};

type ParametroAnalitica = {
  parametro: string;
  unidad?: string;
  valor?: string;
  minimo?: string;
  maximo?: string;
  metodo?: string;
  obligatorio: boolean;
  estado?: "pendiente" | "conforme" | "no_conforme" | "";
  observaciones?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  tipo: OrdenTipo;
  ordenId?: string | null;
}

const emptyState = (tipo: OrdenTipo) => ({
  estado: "borrador" as const,
  numeroOperacion: "",
  fechaProgramada: "",
  horaProgramada: "",
  procesoDocumentalId: "" as string,
  procesoCodigoSnapshot: "",
  procesoVersionSnapshot: "",
  procesoNombreSnapshot: "",
  productoNombre: "",
  categoria: "",
  campana: "",
  loteRef: "",
  depositoOrigenId: "",
  depositoDestinoId: "",
  litrosPrevistos: "",
  litrosReales: "",
  grado: "",
  transportista: "",
  empresaTransportista: "",
  matricula: "",
  remolqueMatricula: "",
  conductorNombre: "",
  conductorDocumento: "",
  conductorTelefono: "",
  numeroPrecinto: "",
  precintosAdicionales: "",
  observaciones: "",
  lot: "",
  cad: "",
  prov: "",
  organoleptico: "",
  especificaciones: "",
  limpiezaConfirmada: false,
  episConfirmados: false,
  limpiezaObs: "",
  epiObs: "",
  declaracionFirmada: false,
  declaracionObs: "",
  labEstado: "pendiente" as "pendiente" | "autorizado" | "rechazado",
  labCargo: "",
  labObservaciones: "",
  comprobaciones: (tipo === "carga"
    ? COMPROBACIONES_CARGA_DEFAULT.map((c) => ({ ...c, estado: "" as const, observaciones: "" }))
    : []) as Comprobacion[],
  parametros: (tipo === "descarga"
    ? PARAMETROS_DESCARGA_DEFAULT.map((p) => ({ ...p, valor: "", estado: "pendiente" as const }))
    : []) as ParametroAnalitica[],
  compartimentos: Array.from({ length: 4 }, (_, i) => ({
    numero: i + 1,
    depositoId: "",
    litrosPrevistos: null,
    litrosReales: null,
    observaciones: "",
  })) as Compartimento[],
});

export function OrdenLogisticaDialog({ open, onOpenChange, bodegaId, tipo, ordenId }: Props) {
  const [state, setState] = React.useState(emptyState(tipo));
  const [tab, setTab] = React.useState("cabecera");
  const { depositos } = useBodegaMap(bodegaId);
  const qc = useQueryClient();

  const procesosFn = useServerFn(listProcesosDoc);
  const procesosQ = useQuery({
    queryKey: ["procesos-doc", bodegaId, tipo],
    queryFn: () => procesosFn({ data: { bodegaId, tipo, soloActivos: true } }),
    enabled: open,
  });

  const getFn = useServerFn(getOrdenLogistica);
  const detailQ = useQuery({
    queryKey: ["orden-log", ordenId],
    queryFn: () => getFn({ data: { id: ordenId! } }),
    enabled: !!ordenId && open,
  });

  // Reset on open
  React.useEffect(() => {
    if (open && !ordenId) {
      setState(emptyState(tipo));
      setTab("cabecera");
    }
  }, [open, tipo, ordenId]);

  // Load existing
  React.useEffect(() => {
    if (!detailQ.data || !ordenId) return;
    const o = detailQ.data.orden;
    const comps = detailQ.data.compartimentos;
    setState({
      ...emptyState(tipo),
      estado: o.estado,
      numeroOperacion: o.numero_operacion ?? "",
      fechaProgramada: o.fecha_programada ?? "",
      horaProgramada: o.hora_programada ?? "",
      procesoDocumentalId: o.proceso_documental_id ?? "",
      procesoCodigoSnapshot: o.proceso_codigo_snapshot ?? "",
      procesoVersionSnapshot: o.proceso_version_snapshot ?? "",
      procesoNombreSnapshot: o.proceso_nombre_snapshot ?? "",
      categoria: o.categoria ?? "",
      campana: o.campana ?? "",
      depositoOrigenId: o.deposito_origen_id ?? "",
      depositoDestinoId: o.deposito_destino_id ?? "",
      litrosPrevistos: o.litros_previstos?.toString() ?? "",
      litrosReales: o.litros_reales?.toString() ?? "",
      grado: o.grado?.toString() ?? "",
      transportista: o.transportista ?? "",
      empresaTransportista: o.empresa_transportista ?? "",
      matricula: o.matricula ?? "",
      remolqueMatricula: o.remolque_matricula ?? "",
      conductorNombre: o.conductor_nombre ?? "",
      conductorDocumento: o.conductor_documento ?? "",
      conductorTelefono: o.conductor_telefono ?? "",
      numeroPrecinto: o.numero_precinto ?? "",
      precintosAdicionales: o.precintos_adicionales ?? "",
      observaciones: o.observaciones ?? "",
      lot: o.instrucciones?.lot ?? "",
      cad: o.instrucciones?.cad ?? "",
      prov: o.instrucciones?.prov ?? "",
      organoleptico: o.instrucciones?.organoleptico ?? "",
      especificaciones: o.instrucciones?.especificaciones ?? "",
      productoNombre: "",
      loteRef: "",
      limpiezaConfirmada: !!o.limpieza_epis?.limpieza,
      episConfirmados: !!o.limpieza_epis?.epis,
      limpiezaObs: o.limpieza_epis?.limpieza_obs ?? "",
      epiObs: o.limpieza_epis?.epi_obs ?? "",
      declaracionFirmada: !!o.declaracion_transportista?.firmada,
      declaracionObs: o.declaracion_transportista?.observaciones ?? "",
      labEstado: o.lab_estado,
      labCargo: o.lab_autorizado_cargo ?? "",
      labObservaciones: o.lab_observaciones ?? "",
      comprobaciones: Array.isArray(o.comprobaciones) && o.comprobaciones.length
        ? o.comprobaciones
        : emptyState(tipo).comprobaciones,
      parametros: Array.isArray(o.instrucciones?.parametros) && o.instrucciones.parametros.length
        ? o.instrucciones.parametros
        : emptyState(tipo).parametros,
      compartimentos: comps.length
        ? comps.map((c: any) => ({
            numero: c.numero,
            depositoId: c.deposito_id ?? "",
            litrosPrevistos: c.litros_previstos,
            litrosReales: c.litros_reales,
            observaciones: c.observaciones ?? "",
          }))
        : emptyState(tipo).compartimentos,
    });
  }, [detailQ.data, ordenId, tipo]);

  const patch = <K extends keyof typeof state>(k: K, v: (typeof state)[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const upsertFn = useServerFn(upsertOrdenLogistica);
  const upsert = useMutation({
    mutationFn: upsertFn,
    onSuccess: (r: any) => {
      toast.success(ordenId ? "Orden actualizada" : "Orden creada");
      qc.invalidateQueries({ queryKey: ["ordenes-log"] });
      qc.invalidateQueries({ queryKey: ["trabajos"] });
      qc.invalidateQueries({ queryKey: ["orden-log", r?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function save(nextEstado?: typeof state.estado) {
    const proc = procesosQ.data?.find((p: any) => p.id === state.procesoDocumentalId);
    upsert.mutate({
      data: {
        id: ordenId ?? null,
        bodegaId,
        tipo,
        estado: nextEstado ?? state.estado,
        prioridad: "normal",
        procesoDocumentalId: state.procesoDocumentalId || null,
        procesoCodigoSnapshot: proc?.codigo ?? state.procesoCodigoSnapshot ?? null,
        procesoVersionSnapshot: proc?.version ?? state.procesoVersionSnapshot ?? null,
        procesoNombreSnapshot: proc?.nombre ?? state.procesoNombreSnapshot ?? null,
        numeroOperacion: state.numeroOperacion || null,
        fechaProgramada: state.fechaProgramada || null,
        horaProgramada: state.horaProgramada || null,
        categoria: state.categoria || null,
        campana: state.campana || null,
        depositoOrigenId: state.depositoOrigenId || null,
        depositoDestinoId: state.depositoDestinoId || null,
        litrosPrevistos: numOrNull(state.litrosPrevistos),
        litrosReales: numOrNull(state.litrosReales),
        grado: numOrNull(state.grado),
        transportista: state.transportista || null,
        empresaTransportista: state.empresaTransportista || null,
        matricula: state.matricula || null,
        remolqueMatricula: state.remolqueMatricula || null,
        conductorNombre: state.conductorNombre || null,
        conductorDocumento: state.conductorDocumento || null,
        conductorTelefono: state.conductorTelefono || null,
        numeroPrecinto: state.numeroPrecinto || null,
        precintosAdicionales: state.precintosAdicionales || null,
        comprobaciones: state.comprobaciones,
        instrucciones: {
          lot: state.lot,
          cad: state.cad,
          prov: state.prov,
          organoleptico: state.organoleptico,
          especificaciones: state.especificaciones,
          parametros: state.parametros,
        },
        limpiezaEpis: {
          limpieza: state.limpiezaConfirmada,
          epis: state.episConfirmados,
          limpieza_obs: state.limpiezaObs,
          epi_obs: state.epiObs,
        },
        declaracionTransportista: {
          firmada: state.declaracionFirmada,
          observaciones: state.declaracionObs,
        },
        labEstado: state.labEstado,
        labAutorizadoCargo: state.labCargo || null,
        labObservaciones: state.labObservaciones || null,
        observaciones: state.observaciones || null,
        compartimentos: state.compartimentos
          .filter((c) => c.depositoId || c.litrosPrevistos || c.litrosReales)
          .map((c) => ({
            numero: c.numero,
            depositoId: c.depositoId || null,
            litrosPrevistos: numOrNull(String(c.litrosPrevistos ?? "")),
            litrosReales: numOrNull(String(c.litrosReales ?? "")),
            observaciones: c.observaciones || null,
          })),
      },
    });
  }

  const Icon = tipo === "carga" ? Truck : PackageOpen;
  const title = tipo === "carga" ? "Orden de carga" : "Orden de descarga";
  const estadoMeta = ESTADO_META[state.estado];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="size-9 rounded-lg flex items-center justify-center bg-primary/15 border border-primary/30">
              <Icon className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <div>{title}{state.numeroOperacion ? ` · ${state.numeroOperacion}` : ""}</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-normal">
                {state.procesoCodigoSnapshot ? `${state.procesoCodigoSnapshot}${state.procesoVersionSnapshot ? ` v${state.procesoVersionSnapshot}` : ""}` : "Sin procedimiento asignado"}
              </div>
            </div>
            <Badge variant="outline" className={estadoMeta.tone}>{estadoMeta.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="cabecera">Cabecera</TabsTrigger>
            <TabsTrigger value="producto">Producto</TabsTrigger>
            <TabsTrigger value="compart">Compartimentos</TabsTrigger>
            <TabsTrigger value="controles">{tipo === "carga" ? "Comprobaciones" : "Analítica"}</TabsTrigger>
            <TabsTrigger value="instrucciones">Instrucciones</TabsTrigger>
            <TabsTrigger value="cierre">Cierre</TabsTrigger>
          </TabsList>

          {/* CABECERA */}
          <TabsContent value="cabecera" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Procedimiento">
                <Select value={state.procesoDocumentalId || "__none"} onValueChange={(v) => patch("procesoDocumentalId", v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Ninguno —</SelectItem>
                    {(procesosQ.data ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} · v{p.version} · {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nº operación"><Input value={state.numeroOperacion} onChange={(e) => patch("numeroOperacion", e.target.value)} /></Field>
              <Field label="Estado">
                <Select value={state.estado} onValueChange={(v) => patch("estado", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORDEN_ESTADOS.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fecha programada"><Input type="date" value={state.fechaProgramada} onChange={(e) => patch("fechaProgramada", e.target.value)} /></Field>
              <Field label="Hora"><Input type="time" value={state.horaProgramada} onChange={(e) => patch("horaProgramada", e.target.value)} /></Field>
              <Field label="Campaña"><Input value={state.campana} onChange={(e) => patch("campana", e.target.value)} /></Field>
              <Field label="Matrícula"><Input value={state.matricula} onChange={(e) => patch("matricula", e.target.value)} /></Field>
              <Field label="Matrícula remolque"><Input value={state.remolqueMatricula} onChange={(e) => patch("remolqueMatricula", e.target.value)} /></Field>
              <Field label="Empresa transportista"><Input value={state.empresaTransportista} onChange={(e) => patch("empresaTransportista", e.target.value)} /></Field>
              <Field label="Conductor"><Input value={state.conductorNombre} onChange={(e) => patch("conductorNombre", e.target.value)} /></Field>
              <Field label="Documento"><Input value={state.conductorDocumento} onChange={(e) => patch("conductorDocumento", e.target.value)} /></Field>
              <Field label="Teléfono"><Input value={state.conductorTelefono} onChange={(e) => patch("conductorTelefono", e.target.value)} /></Field>
            </div>
          </TabsContent>

          {/* PRODUCTO */}
          <TabsContent value="producto" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Categoría / tipo"><Input value={state.categoria} onChange={(e) => patch("categoria", e.target.value)} placeholder="Vino tinto, blanco, mosto…" /></Field>
              <Field label="Lote (referencia)"><Input value={state.loteRef} onChange={(e) => patch("loteRef", e.target.value)} /></Field>
              <Field label="Grado (% vol)"><Input type="number" value={state.grado} onChange={(e) => patch("grado", e.target.value)} /></Field>
              {tipo === "carga" ? (
                <Field label="Depósito de origen">
                  <DepositoSelect value={state.depositoOrigenId} onChange={(v) => patch("depositoOrigenId", v)} depositos={depositos} />
                </Field>
              ) : (
                <Field label="Depósito de destino">
                  <DepositoSelect value={state.depositoDestinoId} onChange={(v) => patch("depositoDestinoId", v)} depositos={depositos} />
                </Field>
              )}
              <Field label="Litros previstos"><Input type="number" value={state.litrosPrevistos} onChange={(e) => patch("litrosPrevistos", e.target.value)} /></Field>
              <Field label="Litros reales"><Input type="number" value={state.litrosReales} onChange={(e) => patch("litrosReales", e.target.value)} /></Field>
            </div>
            <Field label="Observaciones"><Textarea rows={3} value={state.observaciones} onChange={(e) => patch("observaciones", e.target.value)} /></Field>
          </TabsContent>

          {/* COMPARTIMENTOS */}
          <TabsContent value="compart" className="mt-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Suma actual: {state.compartimentos.reduce((a, c) => a + (Number(c.litrosPrevistos) || 0), 0)} L /
                previsto orden: {state.litrosPrevistos || 0} L
              </div>
              <Button size="sm" variant="outline" onClick={() => setState((s) => ({
                ...s,
                compartimentos: [...s.compartimentos, { numero: s.compartimentos.length + 1, depositoId: "", litrosPrevistos: null, litrosReales: null, observaciones: "" }],
              }))}>
                <Plus className="size-3.5 mr-1" />Añadir compartimento
              </Button>
            </div>
            <div className="space-y-2">
              {state.compartimentos.map((c, i) => (
                <div key={i} className="grid grid-cols-[60px_1fr_120px_120px_1fr_auto] gap-2 items-end scada-panel p-2">
                  <Field label="Nº"><Input type="number" value={c.numero} onChange={(e) => updateComp(setState, i, { numero: Number(e.target.value) })} /></Field>
                  <Field label="Depósito">
                    <DepositoSelect
                      value={c.depositoId ?? ""}
                      onChange={(v) => updateComp(setState, i, { depositoId: v })}
                      depositos={depositos}
                    />
                  </Field>
                  <Field label="L. prev"><Input type="number" value={c.litrosPrevistos ?? ""} onChange={(e) => updateComp(setState, i, { litrosPrevistos: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                  <Field label="L. real"><Input type="number" value={c.litrosReales ?? ""} onChange={(e) => updateComp(setState, i, { litrosReales: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                  <Field label="Observaciones"><Input value={c.observaciones ?? ""} onChange={(e) => updateComp(setState, i, { observaciones: e.target.value })} /></Field>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setState((s) => ({ ...s, compartimentos: s.compartimentos.filter((_, idx) => idx !== i) }))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* CONTROLES (comprobaciones o analítica) */}
          <TabsContent value="controles" className="mt-3 space-y-3">
            {tipo === "carga" ? (
              <>
                <div className="text-sm text-muted-foreground">Comprobaciones previas antes de la carga</div>
                <div className="space-y-1.5">
                  {state.comprobaciones.map((c, i) => (
                    <div key={c.key} className="grid grid-cols-[1fr_180px_1.2fr] gap-2 items-center scada-panel p-2">
                      <div className="text-sm">{i + 1}. {c.label}</div>
                      <Select value={c.estado || "__pending"} onValueChange={(v) => setState((s) => ({
                        ...s,
                        comprobaciones: s.comprobaciones.map((x, idx) => idx === i ? { ...x, estado: v === "__pending" ? "" : v as any } : x),
                      }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__pending">Pendiente</SelectItem>
                          <SelectItem value="conforme">Conforme</SelectItem>
                          <SelectItem value="no_conforme">No conforme</SelectItem>
                          <SelectItem value="no_aplica">No aplica</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Observaciones" value={c.observaciones ?? ""} onChange={(e) => setState((s) => ({
                        ...s,
                        comprobaciones: s.comprobaciones.map((x, idx) => idx === i ? { ...x, observaciones: e.target.value } : x),
                      }))} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Parámetros de la analítica de recepción</div>
                  <Button size="sm" variant="outline" onClick={() => setState((s) => ({
                    ...s,
                    parametros: [...s.parametros, { parametro: "", unidad: "", valor: "", obligatorio: false, estado: "pendiente" }],
                  }))}>
                    <Plus className="size-3.5 mr-1" />Añadir parámetro
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {state.parametros.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1.4fr_100px_100px_100px_140px_auto] gap-2 items-end scada-panel p-2">
                      <Field label="Parámetro"><Input value={p.parametro} onChange={(e) => updateParam(setState, i, { parametro: e.target.value })} /></Field>
                      <Field label="Unidad"><Input value={p.unidad ?? ""} onChange={(e) => updateParam(setState, i, { unidad: e.target.value })} /></Field>
                      <Field label="Valor"><Input value={p.valor ?? ""} onChange={(e) => updateParam(setState, i, { valor: e.target.value })} /></Field>
                      <Field label="Obligatorio">
                        <Select value={p.obligatorio ? "si" : "no"} onValueChange={(v) => updateParam(setState, i, { obligatorio: v === "si" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="si">Sí</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Estado">
                        <Select value={p.estado || "pendiente"} onValueChange={(v) => updateParam(setState, i, { estado: v as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="conforme">Conforme</SelectItem>
                            <SelectItem value="no_conforme">No conforme</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setState((s) => ({ ...s, parametros: s.parametros.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* INSTRUCCIONES */}
          <TabsContent value="instrucciones" className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="LOT"><Input value={state.lot} onChange={(e) => patch("lot", e.target.value)} /></Field>
              <Field label="CAD"><Input value={state.cad} onChange={(e) => patch("cad", e.target.value)} /></Field>
              <Field label="PROV"><Input value={state.prov} onChange={(e) => patch("prov", e.target.value)} /></Field>
            </div>
            <Field label="Resultado organoléptico"><Textarea rows={2} value={state.organoleptico} onChange={(e) => patch("organoleptico", e.target.value)} /></Field>
            <Field label={tipo === "carga" ? "Especificaciones del cliente" : "Especificaciones acordadas con el vendedor"}>
              <Textarea rows={2} value={state.especificaciones} onChange={(e) => patch("especificaciones", e.target.value)} />
            </Field>

            <div className="scada-panel p-3 space-y-2">
              <div className="text-sm font-semibold">Limpieza y EPIS</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={state.limpiezaConfirmada} onChange={(e) => patch("limpiezaConfirmada", e.target.checked)} />
                  Limpieza confirmada
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={state.episConfirmados} onChange={(e) => patch("episConfirmados", e.target.checked)} />
                  EPIS confirmados
                </label>
              </div>
              <Field label="Observaciones limpieza"><Input value={state.limpiezaObs} onChange={(e) => patch("limpiezaObs", e.target.value)} /></Field>
              <Field label="Observaciones EPIS"><Input value={state.epiObs} onChange={(e) => patch("epiObs", e.target.value)} /></Field>
            </div>
          </TabsContent>

          {/* CIERRE */}
          <TabsContent value="cierre" className="mt-3 space-y-3">
            <div className="scada-panel p-3 space-y-2">
              <div className="text-sm font-semibold">Autorización de laboratorio</div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Estado">
                  <Select value={state.labEstado} onValueChange={(v) => patch("labEstado", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="autorizado">Autorizado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cargo"><Input value={state.labCargo} onChange={(e) => patch("labCargo", e.target.value)} /></Field>
              </div>
              <Field label="Observaciones de laboratorio"><Textarea rows={2} value={state.labObservaciones} onChange={(e) => patch("labObservaciones", e.target.value)} /></Field>
            </div>

            <div className="scada-panel p-3 space-y-2">
              <div className="text-sm font-semibold">Declaración del transportista</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{DECLARACION_TRANSPORTISTA_TEXTO}</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nº precinto"><Input value={state.numeroPrecinto} onChange={(e) => patch("numeroPrecinto", e.target.value)} /></Field>
                <Field label="Precintos adicionales"><Input value={state.precintosAdicionales} onChange={(e) => patch("precintosAdicionales", e.target.value)} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={state.declaracionFirmada} onChange={(e) => patch("declaracionFirmada", e.target.checked)} />
                Firma recogida en papel
              </label>
              <Field label="Observaciones"><Input value={state.declaracionObs} onChange={(e) => patch("declaracionObs", e.target.value)} /></Field>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {ordenId && (
              <Button variant="outline" asChild>
                <Link to="/ordenes/$id" params={{ id: ordenId }}>
                  <Printer className="size-3.5 mr-1" /> Vista previa
                </Link>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button variant="outline" disabled={upsert.isPending} onClick={() => save("borrador")}>Guardar borrador</Button>
            <Button disabled={upsert.isPending} onClick={() => save("programada")}>Programar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function DepositoSelect({
  value, onChange, depositos,
}: {
  value: string;
  onChange: (v: string) => void;
  depositos: { id: string; codigo: string }[];
}) {
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder="Depósito…" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— Ninguno —</SelectItem>
        {depositos.map((d) => <SelectItem key={d.id} value={d.codigo}>{d.codigo}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function numOrNull(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function updateComp(setState: React.Dispatch<React.SetStateAction<any>>, i: number, patchObj: Partial<Compartimento>) {
  setState((s: any) => ({
    ...s,
    compartimentos: s.compartimentos.map((c: Compartimento, idx: number) => idx === i ? { ...c, ...patchObj } : c),
  }));
}

function updateParam(setState: React.Dispatch<React.SetStateAction<any>>, i: number, patchObj: Partial<ParametroAnalitica>) {
  setState((s: any) => ({
    ...s,
    parametros: s.parametros.map((p: ParametroAnalitica, idx: number) => idx === i ? { ...p, ...patchObj } : p),
  }));
}
