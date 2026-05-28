import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createTrabajo } from "@/lib/api/trabajos.functions";
import { TRABAJO_TIPOS, TIPO_META, type TrabajoTipo } from "@/lib/trabajo-meta";
import { useBodegaMap } from "@/lib/use-bodega-map";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  defaultTipo?: TrabajoTipo;
  defaultOrigen?: string;
  defaultDestino?: string;
}

export function TrabajoFormDialog({ open, onOpenChange, bodegaId, defaultTipo, defaultOrigen, defaultDestino }: Props) {
  const [tipo, setTipo] = React.useState<TrabajoTipo>(defaultTipo ?? "trasiego");
  React.useEffect(() => { if (defaultTipo) setTipo(defaultTipo); }, [defaultTipo, open]);

  const { depositos, zonas } = useBodegaMap();


  const [titulo, setTitulo] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [prioridad, setPrioridad] = React.useState("normal");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [origen, setOrigen] = React.useState<string>("");
  const [destino, setDestino] = React.useState<string>("");
  const [datos, setDatos] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setOrigen(defaultOrigen ?? "");
      setDestino(defaultDestino ?? "");
    } else {
      setTitulo(""); setDescripcion(""); setPrioridad("normal");
      setScheduledAt(""); setOrigen(""); setDestino(""); setDatos({});
    }
  }, [open, defaultOrigen, defaultDestino]);


  const fn = useServerFn(createTrabajo);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Trabajo creado");
      qc.invalidateQueries({ queryKey: ["trabajos"] });
      qc.invalidateQueries({ queryKey: ["actividad"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = TIPO_META[tipo];
  const Icon = meta.icon;

  function submit() {
    const datosNum: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(datos)) {
      if (v === "") continue;
      const n = Number(v);
      datosNum[k] = Number.isFinite(n) && /^[\d.,-]+$/.test(v) ? n : v;
    }
    // Autotítulo si no se ha escrito
    const autoBits = [meta.label, origen, destino].filter(Boolean).join(" · ");
    const finalTitulo = titulo.trim() || autoBits || meta.label;
    m.mutate({ data: {
      bodegaId,
      tipo,
      titulo: finalTitulo,
      descripcion: descripcion.trim() || undefined,
      prioridad: prioridad as any,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      deposito_origen: origen || undefined,
      deposito_destino: destino || undefined,
      datos: datosNum,
      estado: "pendiente",
    }});
  }

  const setD = (k: string, v: string) => setDatos((d) => ({ ...d, [k]: v }));
  // IMPORTANT: render inline (no nested component) to avoid input remount/focus loss on each keystroke.
  function renderSpecificFields() {
    switch (tipo) {
      case "trasiego":
        return (
          <>
            <DepSelect label="Depósito origen" value={origen} onChange={setOrigen} depositos={depositos} zonas={zonas} />
            <DepSelect label="Depósito destino" value={destino} onChange={setDestino} depositos={depositos} zonas={zonas} />
            <NumField label="Litros" value={datos.litros ?? ""} onChange={(v) => setD("litros", v)} />
            <TxtField label="Variedad" value={datos.variedad ?? ""} onChange={(v) => setD("variedad", v)} />
          </>
        );
      case "vendimia":
        return (
          <>
            <DepSelect label="Depósito" value={destino} onChange={setDestino} depositos={depositos} zonas={zonas} />
            <NumField label="Litros" value={datos.litros ?? ""} onChange={(v) => setD("litros", v)} />
            <TxtField label="Variedad" value={datos.variedad ?? ""} onChange={(v) => setD("variedad", v)} />
          </>
        );
      case "producto":
        return (
          <>
            <DepSelect label="Depósito" value={destino} onChange={setDestino} depositos={depositos} zonas={zonas} />
            <TxtField label="Producto" value={datos.producto ?? ""} onChange={(v) => setD("producto", v)} />
            <NumField label="Dosis (g/hl o ml/hl)" value={datos.dosis ?? ""} onChange={(v) => setD("dosis", v)} />
            <TxtField label="Lote / proveedor" value={datos.lote ?? ""} onChange={(v) => setD("lote", v)} />
          </>
        );
      case "limpieza":
        return (
          <>
            <DepSelect label="Depósito / equipo" value={destino} onChange={setDestino} depositos={depositos} zonas={zonas} />
            <TxtField label="Producto" value={datos.producto ?? ""} onChange={(v) => setD("producto", v)} />
            <TxtField label="Método (CIP, manual…)" value={datos.metodo ?? ""} onChange={(v) => setD("metodo", v)} />
          </>
        );
      case "embotellado":
        return (
          <>
            <DepSelect label="Depósito origen" value={origen} onChange={setOrigen} depositos={depositos} zonas={zonas} />
            <NumField label="Botellas" value={datos.botellas ?? ""} onChange={(v) => setD("botellas", v)} />
            <TxtField label="Formato (75cl, magnum…)" value={datos.formato ?? ""} onChange={(v) => setD("formato", v)} />
            <TxtField label="Etiqueta / referencia" value={datos.etiqueta ?? ""} onChange={(v) => setD("etiqueta", v)} />
            <TxtField label="Lote" value={datos.lote ?? ""} onChange={(v) => setD("lote", v)} />
          </>
        );
      case "incidencia":
        return (
          <>
            <DepSelect label="Depósito (si aplica)" value={destino} onChange={setDestino} depositos={depositos} zonas={zonas} />
            <TxtField label="Severidad (leve/media/alta)" value={datos.severidad ?? ""} onChange={(v) => setD("severidad", v)} />
          </>
        );
      case "observacion":
        return <DepSelect label="Depósito (opcional)" value={destino} onChange={setDestino} depositos={depositos} zonas={zonas} />;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="size-9 rounded-lg flex items-center justify-center"
              style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${meta.color} 40%, transparent)` }}>
              <Icon className="size-5" style={{ color: meta.color }} />
            </div>
            Nuevo trabajo · {meta.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">


          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-white" />
                Programar
              </Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>

          </div>

          <div className="border-t border-border pt-3 space-y-3">
            {renderSpecificFields()}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={2000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>{m.isPending ? "Guardando…" : "Crear trabajo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepSelect({
  label, value, onChange, depositos, zonas,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  depositos: { id: string; codigo: string; zona_id: string }[];
  zonas: { id: string; nombre: string }[];
}) {
  // Resolve current zona from selected codigo (so the UI stays in sync if value comes from outside)
  const currentZonaFromValue = React.useMemo(
    () => depositos.find((d) => d.codigo === value)?.zona_id ?? "",
    [depositos, value],
  );
  const [zonaId, setZonaId] = React.useState<string>(currentZonaFromValue);
  React.useEffect(() => { setZonaId(currentZonaFromValue); }, [currentZonaFromValue]);

  const depsZona = React.useMemo(
    () => depositos.filter((d) => d.zona_id === zonaId).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [depositos, zonaId],
  );

  return (
    <div>
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={zonaId || "__none"}
          onValueChange={(v) => {
            const z = v === "__none" ? "" : v;
            setZonaId(z);
            // Si la zona cambia y el depósito actual no pertenece, limpiamos
            if (value && !depositos.some((d) => d.codigo === value && d.zona_id === z)) {
              onChange("");
            }
          }}
        >
          <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— Zona —</SelectItem>
            {zonas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={value || "__none"}
          onValueChange={(v) => onChange(v === "__none" ? "" : v)}
          disabled={!zonaId}
        >
          <SelectTrigger><SelectValue placeholder={zonaId ? "Depósito" : "Elige zona…"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— Ninguno —</SelectItem>
            {depsZona.map((d) => <SelectItem key={d.id} value={d.codigo}>{d.codigo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><Label>{label}</Label><Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function TxtField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} /></div>;
}
