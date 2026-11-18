import * as React from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCatalogoOperaciones } from "./use-catalogo";
import { CAPACIDADES, TIPO_FORMULARIO_LABEL, iconoFamilia, operacionesDisponibles, type Familia, type Operacion } from "@/lib/operaciones-meta";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  centroNombre?: string;
  onContinue: (op: Operacion, familia: Familia) => void;
}

export function SelectorOperacionDialog({ open, onOpenChange, bodegaId, centroNombre, onContinue }: Props) {
  const q = useCatalogoOperaciones([bodegaId]);
  const [famId, setFamId] = React.useState<string | null>(null);
  const [opId, setOpId] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");
  React.useEffect(() => { if (!open) { setFamId(null); setOpId(null); setBusca(""); } }, [open]);

  const disponibles = React.useMemo(
    () => q.data ? operacionesDisponibles(q.data.familias, q.data.operaciones, q.data.centro, bodegaId) : [],
    [q.data, bodegaId],
  );
  const familias = (q.data?.familias ?? []).filter((f) => disponibles.some((o) => o.familia_id === f.id));
  const familia = familias.find((f) => f.id === famId) ?? null;
  const term = busca.trim().toLowerCase();
  const ops = term
    ? disponibles.filter((o) => o.nombre.toLowerCase().includes(term) || o.codigo.toLowerCase().includes(term))
    : disponibles.filter((o) => o.familia_id === famId);
  const op = disponibles.find((o) => o.id === opId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{familia || term ? "Seleccionar operación" : "Seleccionar familia operativa"}</DialogTitle>
          <DialogDescription>
            {centroNombre ?? "Centro activo"}{familia ? ` → ${familia.nombre}` : ""}{op ? ` → ${op.nombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar operación en todas las familias…" value={busca}
            onChange={(e) => { setBusca(e.target.value); setOpId(null); }} />
        </div>

        {q.isLoading ? <div className="p-6 text-sm text-muted-foreground">Cargando catálogo…</div>
        : q.error ? <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>
        : !familia && !term ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {familias.map((f) => {
              const Icon = iconoFamilia(f.icono);
              const n = disponibles.filter((o) => o.familia_id === f.id).length;
              return (
                <button key={f.id} type="button" onClick={() => setFamId(f.id)}
                  className="rounded-lg border bg-card p-3 text-left hover:bg-accent/40 transition-colors flex gap-3 items-start">
                  <div className="size-9 shrink-0 rounded-md flex items-center justify-center"
                    style={{ background: `color-mix(in oklab, ${f.color} 15%, transparent)` }}>
                    <Icon className="size-5" style={{ color: f.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-muted-foreground">{f.codigo}</div>
                    <div className="text-[13px] font-medium leading-tight">{f.nombre}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{n} operaciones</div>
                  </div>
                </button>
              );
            })}
            {familias.length === 0 && <div className="col-span-full p-6 text-sm text-muted-foreground">Este centro no tiene operaciones habilitadas.</div>}
          </div>
        ) : (
          <div className="space-y-2">
            {familia && !term && (
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
            <Button onClick={() => {
              const f = (q.data?.familias ?? []).find((x) => x.id === op.familia_id)!;
              onContinue(op, f);
            }}>
              Continuar con la orden <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
