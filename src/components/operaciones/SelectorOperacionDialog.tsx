import * as React from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCatalogoOperaciones } from "./use-catalogo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { TIPOS_PENDIENTES_CONFIG, CAPACIDADES, TIPO_FORMULARIO_LABEL, iconoFamilia, operacionesDisponibles, type Familia, type Operacion } from "@/lib/operaciones-meta";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  centroNombre?: string;
  onContinue: (op: Operacion | null, familia: Familia | undefined, centroId: string) => void;
  /** Acceso rápido: limita las operaciones a un tipo de formulario. */
  tipoFormulario?: string | null;
  tipoLabel?: string;
}

export function SelectorOperacionDialog({ open, onOpenChange, bodegaId: centroInicial, onContinue, tipoFormulario, tipoLabel }: Props) {
  // Centro de destino del trabajo: independiente del centro activo general.
  const { bodegas } = useActiveBodega();
  const [bodegaId, setCentro] = React.useState(centroInicial);
  const q = useCatalogoOperaciones([bodegaId]);
  const [famId, setFamId] = React.useState<string | null>(null);
  const [opId, setOpId] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");
  React.useEffect(() => { if (!open) { setFamId(null); setOpId(null); setBusca(""); setCentro(centroInicial); } }, [open, centroInicial]);
  const centroNombre = bodegas.find((b) => b.bodega_id === bodegaId)?.bodega.nombre;

  const disponibles = React.useMemo(
    () => q.data ? operacionesDisponibles(q.data.familias, q.data.operaciones, q.data.centro, bodegaId) : [],
    [q.data, bodegaId],
  );
  const familias = (q.data?.familias ?? []).filter((f) => f.activo && (!f.bodega_id || f.bodega_id === bodegaId));
  const familia = familias.find((f) => f.id === famId) ?? null;
  const term = busca.trim().toLowerCase();
  const porTipo = tipoFormulario ? disponibles.filter((o) => o.tipo_formulario === tipoFormulario) : null;
  const ops = term
    ? (porTipo ?? disponibles).filter((o) => o.nombre.toLowerCase().includes(term) || o.codigo.toLowerCase().includes(term))
    : porTipo ?? disponibles.filter((o) => o.familia_id === famId);
  const op = disponibles.find((o) => o.id === opId) ?? null;
  const pendienteConfig = !!op && TIPOS_PENDIENTES_CONFIG.has(op.tipo_formulario);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipoFormulario ? `Nuevo · ${tipoLabel ?? tipoFormulario}` : familia || term ? "Seleccionar operación" : "Seleccionar familia operativa"}</DialogTitle>
          <DialogDescription>
            {centroNombre ?? "Centro activo"}{familia ? ` → ${familia.nombre}` : ""}{op ? ` → ${op.nombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label>Centro de destino del trabajo *</Label>
          <Select value={bodegaId} onValueChange={(v) => { setCentro(v); setOpId(null); }}>
            <SelectTrigger aria-label="Centro de destino del trabajo"><SelectValue placeholder="Selecciona centro" /></SelectTrigger>
            <SelectContent>
              {bodegas.map((b) => <SelectItem key={b.bodega_id} value={b.bodega_id}>{b.bodega.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar operación en todas las familias…" value={busca}
            onChange={(e) => { setBusca(e.target.value); setOpId(null); }} />
        </div>

        {q.isLoading ? <div className="p-6 text-sm text-muted-foreground">Cargando catálogo…</div>
        : q.error ? <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>
        : !familia && !term && !porTipo ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {familias.map((f) => {
              const Icon = iconoFamilia(f.icono);
              const n = disponibles.filter((o) => o.familia_id === f.id).length;
              return (
                <button key={f.id} type="button" onClick={() => setFamId(f.id)} disabled={n === 0}
                  className="rounded-lg border bg-card p-3 text-left hover:bg-accent/40 transition-colors flex gap-3 items-start disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="size-9 shrink-0 rounded-md flex items-center justify-center"
                    style={{ background: `color-mix(in oklab, ${f.color} 15%, transparent)` }}>
                    <Icon className="size-5" style={{ color: f.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-muted-foreground">{f.codigo}</div>
                    <div className="text-[13px] font-medium leading-tight">{f.nombre}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{n === 0 ? "Sin operaciones en este centro" : `${n} operaciones`}</div>
                  </div>
                </button>
              );
            })}
            {familias.length === 0 && <div className="col-span-full p-6 text-sm text-muted-foreground">Este centro no tiene operaciones habilitadas.</div>}
          </div>
        ) : (
          <div className="space-y-2">
            {porTipo && porTipo.length === 0 && !term && (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground flex items-center justify-between gap-3">
                <span>No hay operaciones del catálogo de este tipo en {centroNombre ?? "el centro"}.</span>
                <Button size="sm" onClick={() => onContinue(null, undefined, bodegaId)}>Continuar <ChevronRight className="size-4 ml-1" /></Button>
              </div>
            )}
            {familia && !term && !porTipo && (
              <Button variant="ghost" size="sm" onClick={() => { setFamId(null); setOpId(null); }}>
                <ArrowLeft className="size-4 mr-1" />Familias
              </Button>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              {ops.map((o) => (
                <button key={o.id} type="button" onClick={() => setOpId(o.id)}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${opId === o.id ? "border-primary bg-primary/5" : "bg-card hover:bg-accent/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{o.nombre}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{o.codigo}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{TIPO_FORMULARIO_LABEL[o.tipo_formulario] ?? o.tipo_formulario}</div>
                </button>
              ))}
              {ops.length === 0 && <div className="col-span-full p-4 text-sm text-muted-foreground">Sin resultados.</div>}
            </div>
          </div>
        )}

        {op && (
          <div className="border-t pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              {CAPACIDADES.filter((c) => op[c.key]).map((c) => <Badge key={c.key} variant="secondary" className="text-[10px]">{c.label}</Badge>)}
            </div>
            {pendienteConfig && (
              <div className="text-xs rounded border border-border bg-muted px-2 py-1">Operación pendiente de configuración específica (requiere centro y depósito de origen y destino).</div>
            )}
            <Button disabled={pendienteConfig} onClick={() => {
              const f = (q.data?.familias ?? []).find((x) => x.id === op.familia_id);
              onContinue(op, f, bodegaId);
            }}>
              Continuar con la orden <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
