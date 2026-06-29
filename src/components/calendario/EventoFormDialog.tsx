import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CAL_TIPOS, CAL_ESTADOS, CAL_PRIORIDADES, CAL_TIPO_META,
  type CalTipo, type CalEstado, type CalPrioridad,
} from "@/lib/calendario-meta";
import { createEvento, updateEvento, listAsignables } from "@/lib/api/calendario.functions";
import { listClientes, listProveedores, listContratosCompra, listContratosVenta } from "@/lib/api/contratos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";
import { listTrabajos } from "@/lib/api/trabajos.functions";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { AlertTriangle, Save, X } from "lucide-react";

type EventoExistente = {
  id: string;
  bodega_id: string;
  tipo: CalTipo;
  titulo: string;
  descripcion: string | null;
  zona_id: string | null;
  deposito_origen: string | null;
  deposito_destino: string | null;
  producto_id: string | null;
  contrato_compra_id: string | null;
  contrato_venta_id: string | null;
  trabajo_id: string | null;
  cliente_id: string | null;
  proveedor_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: CalEstado;
  prioridad: CalPrioridad;
  datos: Record<string, any> | null;
  observaciones: string | null;
  asignados?: Array<{ user_id: string }>;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  defaults?: { tipo?: CalTipo; fechaInicio?: string };
  evento?: EventoExistente | null;
}

function isoLocal(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function EventoFormDialog({ open, onOpenChange, bodegaId, defaults, evento }: Props) {
  const isEdit = !!evento;
  const [tipo, setTipo] = React.useState<CalTipo>(evento?.tipo ?? defaults?.tipo ?? "trabajo");
  const [titulo, setTitulo] = React.useState(evento?.titulo ?? "");
  const [descripcion, setDescripcion] = React.useState(evento?.descripcion ?? "");
  const [fechaInicio, setFechaInicio] = React.useState(isoLocal(evento?.fecha_inicio ?? defaults?.fechaInicio ?? new Date().toISOString()));
  const [fechaFin, setFechaFin] = React.useState(isoLocal(evento?.fecha_fin ?? new Date(Date.now() + 3600_000).toISOString()));
  const [estado, setEstado] = React.useState<CalEstado>(evento?.estado ?? "programado");
  const [prioridad, setPrioridad] = React.useState<CalPrioridad>(evento?.prioridad ?? "normal");
  const [origen, setOrigen] = React.useState(evento?.deposito_origen ?? "");
  const [destino, setDestino] = React.useState(evento?.deposito_destino ?? "");
  const [productoId, setProductoId] = React.useState(evento?.producto_id ?? "");
  const [contratoCompraId, setContratoCompraId] = React.useState(evento?.contrato_compra_id ?? "");
  const [contratoVentaId, setContratoVentaId] = React.useState(evento?.contrato_venta_id ?? "");
  const [clienteId, setClienteId] = React.useState(evento?.cliente_id ?? "");
  const [proveedorId, setProveedorId] = React.useState(evento?.proveedor_id ?? "");
  const [trabajoId, setTrabajoId] = React.useState(evento?.trabajo_id ?? "");
  const [trabajadores, setTrabajadores] = React.useState<string[]>(
    (evento?.asignados ?? []).map((a) => a.user_id),
  );
  const [observaciones, setObservaciones] = React.useState(evento?.observaciones ?? "");
  const [datos, setDatos] = React.useState<Record<string, string>>(
    Object.fromEntries(Object.entries(evento?.datos ?? {}).map(([k, v]) => [k, String(v ?? "")])),
  );
  const [conflictos, setConflictos] = React.useState<string[]>([]);
  const [ignoreConflicts, setIgnoreConflicts] = React.useState(false);

  React.useEffect(() => {
    if (open && !isEdit) {
      setTitulo(""); setDescripcion(""); setOrigen(""); setDestino("");
      setProductoId(""); setContratoCompraId(""); setContratoVentaId("");
      setClienteId(""); setProveedorId(""); setTrabajoId("");
      setTrabajadores([]); setObservaciones(""); setDatos({});
      setEstado("programado"); setPrioridad("normal");
      setTipo(defaults?.tipo ?? "trabajo");
      setFechaInicio(isoLocal(defaults?.fechaInicio ?? new Date().toISOString()));
      setFechaFin(isoLocal(new Date(Date.now() + 3600_000).toISOString()));
      setConflictos([]); setIgnoreConflicts(false);
    }
  }, [open, isEdit, defaults?.tipo, defaults?.fechaInicio]);

  const { depositos } = useBodegaMap(bodegaId);
  const fnAsign = useServerFn(listAsignables);
  const fnClientes = useServerFn(listClientes);
  const fnProv = useServerFn(listProveedores);
  const fnProd = useServerFn(listProductosComerciales);
  const fnCC = useServerFn(listContratosCompra);
  const fnCV = useServerFn(listContratosVenta);
  const fnTrab = useServerFn(listTrabajos);

  const asign = useQuery({ queryKey: ["cal-asignables", bodegaId], queryFn: () => fnAsign({ data: { bodegaId } }), enabled: !!bodegaId && open });
  const clientes = useQuery({ queryKey: ["cal-clientes", bodegaId], queryFn: () => fnClientes({ data: { bodegaId } }), enabled: open });
  const provs = useQuery({ queryKey: ["cal-prov", bodegaId], queryFn: () => fnProv({ data: { bodegaId } }), enabled: open });
  const productos = useQuery({ queryKey: ["cal-prods", bodegaId], queryFn: () => fnProd({ data: { bodegaId } }), enabled: open });
  const cc = useQuery({ queryKey: ["cal-cc", bodegaId], queryFn: () => fnCC({ data: { bodegaId } }), enabled: open });
  const cv = useQuery({ queryKey: ["cal-cv", bodegaId], queryFn: () => fnCV({ data: { bodegaId } }), enabled: open });
  const trabajos = useQuery({ queryKey: ["cal-trabajos", bodegaId], queryFn: () => fnTrab({ data: { bodegaId, limit: 100, offset: 0 } as any }), enabled: open });

  const qc = useQueryClient();
  const fnCreate = useServerFn(createEvento);
  const fnUpdate = useServerFn(updateEvento);

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        bodegaId, tipo, titulo,
        descripcion: descripcion || null,
        depositoOrigen: origen || null,
        depositoDestino: destino || null,
        productoId: productoId || null,
        contratoCompraId: contratoCompraId || null,
        contratoVentaId: contratoVentaId || null,
        trabajoId: trabajoId || null,
        clienteId: clienteId || null,
        proveedorId: proveedorId || null,
        fechaInicio: new Date(fechaInicio).toISOString(),
        fechaFin: new Date(fechaFin).toISOString(),
        estado, prioridad,
        datos,
        observaciones: observaciones || null,
        trabajadores,
        ignoreConflicts,
      };
      if (isEdit && evento) {
        return fnUpdate({ data: { ...payload, id: evento.id } });
      }
      return fnCreate({ data: payload });
    },
    onSuccess: (res: any) => {
      if (res && res.ok === false && res.conflictos?.length) {
        setConflictos(res.conflictos);
        toast.warning(`${res.conflictos.length} conflicto(s) detectado(s)`);
        return;
      }
      toast.success(isEdit ? "Evento actualizado" : "Evento creado");
      qc.invalidateQueries({ queryKey: ["calendario"] });
      qc.invalidateQueries({ queryKey: ["calendario-hoy"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = CAL_TIPO_META[tipo];
  const Icon = meta?.icon ?? AlertTriangle;
  const isCarga = tipo === "carga" || tipo === "descarga";

  function submit() {
    if (!titulo.trim()) return toast.error("Indica un título");
    if (!fechaInicio || !fechaFin) return toast.error("Fechas requeridas");
    if (new Date(fechaFin) <= new Date(fechaInicio)) return toast.error("La fecha de fin debe ser posterior al inicio");
    mut.mutate();
  }

  function setDato(k: string, v: string) {
    setDatos((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5" style={{ color: meta?.color }} />
            {isEdit ? "Editar evento" : "Nuevo evento"}
          </DialogTitle>
          <DialogDescription>Programa una operación, trabajo o recordatorio.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Tipo">
            <Select value={tipo} onValueChange={(v) => setTipo(v as CalTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAL_TIPOS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Carga camión Bodegas X" />
          </Field>

          <Field label="Fecha y hora inicio">
            <Input type="datetime-local" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </Field>
          <Field label="Fecha y hora fin">
            <Input type="datetime-local" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </Field>

          <Field label="Estado">
            <Select value={estado} onValueChange={(v) => setEstado(v as CalEstado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAL_ESTADOS.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v as CalPrioridad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAL_PRIORIDADES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Depósito origen">
            <DepositoSelect value={origen} onChange={setOrigen} options={depositos} />
          </Field>
          <Field label="Depósito destino">
            <DepositoSelect value={destino} onChange={setDestino} options={depositos} />
          </Field>

          <Field label="Producto">
            <SelectMaybe value={productoId} onChange={setProductoId} placeholder="—"
              options={(productos.data ?? []).map((p: any) => ({ value: p.id, label: p.nombre }))} />
          </Field>
          <Field label="Trabajo relacionado">
            <SelectMaybe value={trabajoId} onChange={setTrabajoId} placeholder="—"
              options={(trabajos.data ?? []).slice(0, 50).map((t: any) => ({ value: t.id, label: `${t.tipo} · ${(t.titulo ?? "").slice(0, 40)}` }))} />
          </Field>

          <Field label="Contrato compra">
            <SelectMaybe value={contratoCompraId} onChange={setContratoCompraId} placeholder="—"
              options={(cc.data ?? []).map((c: any) => ({ value: c.id, label: `${c.codigo ?? c.id.slice(0, 6)} · ${c.proveedor_nombre ?? ""}` }))} />
          </Field>
          <Field label="Contrato venta">
            <SelectMaybe value={contratoVentaId} onChange={setContratoVentaId} placeholder="—"
              options={(cv.data ?? []).map((c: any) => ({ value: c.id, label: `${c.codigo ?? c.id.slice(0, 6)} · ${c.cliente_nombre ?? ""}` }))} />
          </Field>

          <Field label="Cliente">
            <SelectMaybe value={clienteId} onChange={setClienteId} placeholder="—"
              options={(clientes.data ?? []).map((c: any) => ({ value: c.id, label: c.nombre }))} />
          </Field>
          <Field label="Proveedor">
            <SelectMaybe value={proveedorId} onChange={setProveedorId} placeholder="—"
              options={(provs.data ?? []).map((c: any) => ({ value: c.id, label: c.nombre }))} />
          </Field>
        </div>

        {isCarga && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {tipo === "carga" ? "Datos del camión (carga)" : "Datos del camión (descarga)"}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Transportista"><Input value={datos.transportista ?? ""} onChange={(e) => setDato("transportista", e.target.value)} /></Field>
              <Field label="Matrícula"><Input value={datos.matricula ?? ""} onChange={(e) => setDato("matricula", e.target.value)} /></Field>
              <Field label="Conductor"><Input value={datos.conductor ?? ""} onChange={(e) => setDato("conductor", e.target.value)} /></Field>
              <Field label="Teléfono"><Input value={datos.telefono ?? ""} onChange={(e) => setDato("telefono", e.target.value)} /></Field>
              <Field label="Litros previstos"><Input type="number" value={datos.litros_previstos ?? ""} onChange={(e) => setDato("litros_previstos", e.target.value)} /></Field>
              <Field label="Hora real"><Input value={datos.hora_real ?? ""} onChange={(e) => setDato("hora_real", e.target.value)} placeholder="HH:mm" /></Field>
              <Field label="Documentación pendiente"><Input value={datos.documentacion ?? ""} onChange={(e) => setDato("documentacion", e.target.value)} /></Field>
            </div>
          </div>
        )}

        <div className="mt-3">
          <Label className="text-xs text-muted-foreground">Trabajadores asignados</Label>
          <div className="mt-1 flex flex-wrap gap-1.5 p-2 border border-border rounded-md min-h-[44px]">
            {(asign.data ?? []).length === 0 && <span className="text-xs text-muted-foreground">Sin miembros disponibles</span>}
            {(asign.data ?? []).map((u: any) => {
              const sel = trabajadores.includes(u.user_id);
              return (
                <button type="button" key={u.user_id}
                  onClick={() => setTrabajadores((p) => sel ? p.filter((x) => x !== u.user_id) : [...p, u.user_id])}
                  className={`text-xs px-2 py-1 rounded-md border ${sel ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"}`}>
                  {u.nombre ?? u.email ?? "Usuario"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <Field label="Descripción"><Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Field>
        </div>
        <div className="mt-2">
          <Field label="Observaciones"><Textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Field>
        </div>

        {conflictos.length > 0 && (
          <div className="mt-3 p-3 rounded-md border border-state-incidencia/40 bg-state-incidencia/10 text-sm">
            <div className="flex items-center gap-2 font-medium text-state-incidencia mb-1">
              <AlertTriangle className="size-4" /> Conflictos detectados
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-foreground">
              {conflictos.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={ignoreConflicts} onChange={(e) => setIgnoreConflicts(e.target.checked)} />
              Guardar de todos modos
            </label>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="size-4 mr-1" /> Cancelar</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            <Save className="size-4 mr-1" /> {mut.isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DepositoSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: any[] }) {
  return (
    <SelectMaybe value={value} onChange={onChange} placeholder="—"
      options={options.map((d: any) => ({ value: d.codigo ?? d.id, label: `${d.codigo ?? d.id} · ${d.capacidad ?? 0} L` }))} />
  );
}

function SelectMaybe({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Ninguno —</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
