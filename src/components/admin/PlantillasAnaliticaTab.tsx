import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, Pencil, X, ArrowUp, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  listPlantillasAnalitica, upsertPlantillaAnalitica, deletePlantillaAnalitica,
} from "@/lib/api/plantillas-analitica.functions";
import { PARAMETROS_ANALITICA } from "@/lib/api/analiticas.functions";

const CATEGORIAS = ["", "vino_tinto", "vino_blanco", "mosto", "alcohol", "producto_terminado", "otro"];

type ParamState = {
  parametro: string;
  unidad: string;
  minimo: number | null;
  maximo: number | null;
  obligatorio: boolean;
  metodo: string;
  orden: number;
};

function emptyParam(): ParamState {
  return { parametro: "", unidad: "", minimo: null, maximo: null, obligatorio: false, metodo: "", orden: 0 };
}

export function PlantillasAnaliticaTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlantillasAnalitica);
  const upsertFn = useServerFn(upsertPlantillaAnalitica);
  const delFn = useServerFn(deletePlantillaAnalitica);

  const q = useQuery({
    queryKey: ["admin-plantillas-analitica", bodegaId],
    queryFn: () => listFn({ data: { bodegaId, soloActivas: false } }),
    enabled: !!bodegaId,
  });

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plantillas-analitica"] });
      qc.invalidateQueries({ queryKey: ["plantillas-analitica"] });
      toast.success("Plantilla eliminada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const rows = q.data ?? [];

  return (
    <div className="rounded-xl border bg-card p-4 md:p-6" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-lg">Plantillas analíticas</h2>
          <p className="text-xs text-muted-foreground">
            Parámetros predefinidos para las órdenes de descarga.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1" /> Nueva plantilla
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Sin plantillas configuradas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p: any) => (
            <div key={p.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {p.nombre}
                    {p.es_default && <Badge variant="outline" className="text-[9px]">default</Badge>}
                    {!p.activo && <Badge variant="outline" className="text-[9px]">inactiva</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.categoria_producto ?? "sin categoría"} · {(p.parametros ?? []).length} parámetros
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm(`¿Eliminar plantilla "${p.nombre}"?`) && delM.mutate(p.id)}>
                    <Trash2 className="size-3.5 text-state-incidencia" />
                  </Button>
                </div>
              </div>
              <ul className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                {(p.parametros ?? []).slice(0, 5).map((x: any) => (
                  <li key={x.id} className="truncate">
                    {x.obligatorio && <span className="text-state-incidencia">*</span>} {x.parametro}
                    {x.unidad ? ` (${x.unidad})` : ""}
                  </li>
                ))}
                {(p.parametros ?? []).length > 5 && <li>…</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      <PlantillaEditor
        open={open}
        onOpenChange={setOpen}
        bodegaId={bodegaId}
        initial={editing}
        upsertFn={upsertFn}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-plantillas-analitica"] });
          qc.invalidateQueries({ queryKey: ["plantillas-analitica"] });
        }}
      />
    </div>
  );
}

function PlantillaEditor({ open, onOpenChange, bodegaId, initial, upsertFn, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; bodegaId: string;
  initial: any | null; upsertFn: any; onSaved: () => void;
}) {
  const [nombre, setNombre] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [activo, setActivo] = React.useState(true);
  const [esDefault, setEsDefault] = React.useState(false);
  const [params, setParams] = React.useState<ParamState[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setNombre(initial?.nombre ?? "");
    setCat(initial?.categoria_producto ?? "");
    setDescripcion(initial?.descripcion ?? "");
    setActivo(initial?.activo ?? true);
    setEsDefault(initial?.es_default ?? false);
    setParams(
      (initial?.parametros ?? [])
        .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
        .map((x: any) => ({
          parametro: x.parametro,
          unidad: x.unidad ?? "",
          minimo: x.minimo != null ? Number(x.minimo) : null,
          maximo: x.maximo != null ? Number(x.maximo) : null,
          obligatorio: !!x.obligatorio,
          metodo: x.metodo ?? "",
          orden: x.orden ?? 0,
        })),
    );
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: initial?.id ?? null,
          bodegaId,
          nombre, descripcion: descripcion || null,
          categoriaProducto: cat || null,
          activo, esDefault,
          parametros: params.map((p, i) => ({ ...p, orden: i })),
        },
      }),
    onSuccess: () => { toast.success("Plantilla guardada"); onSaved(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function setP(i: number, patch: Partial<ParamState>) {
    const next = params.slice();
    next[i] = { ...next[i], ...patch };
    setParams(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label className="text-xs">Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Categoría</Label>
            <Select value={cat || "__none__"} onValueChange={(v) => setCat(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c || "__none__"} value={c || "__none__"}>{c || "—"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={activo} onCheckedChange={(v) => setActivo(!!v)} /> Activa</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={esDefault} onCheckedChange={(v) => setEsDefault(!!v)} /> Predeterminada</label>
          </div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">Descripción</Label><Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
        </div>

        <div className="mt-3 rounded-md border border-border">
          <div className="flex items-center justify-between p-2 bg-muted/50">
            <span className="text-xs font-medium">Parámetros ({params.length})</span>
            <Button size="sm" variant="outline" type="button" onClick={() => setParams([...params, emptyParam()])}>
              <Plus className="size-3.5 mr-1" /> Añadir parámetro
            </Button>
          </div>
          {params.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Sin parámetros</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left px-1.5 py-1">Parámetro</th>
                  <th className="text-left px-1.5 py-1 w-16">Ud.</th>
                  <th className="text-right px-1.5 py-1 w-16">Mín</th>
                  <th className="text-right px-1.5 py-1 w-16">Máx</th>
                  <th className="text-center px-1.5 py-1 w-10">Obl.</th>
                  <th className="text-left px-1.5 py-1">Método</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {params.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-1 py-1">
                      <Input list="plant-param-suggest" value={p.parametro} onChange={(e) => setP(i, { parametro: e.target.value })} className="h-7 text-[11px]" />
                    </td>
                    <td className="px-1 py-1"><Input value={p.unidad} onChange={(e) => setP(i, { unidad: e.target.value })} className="h-7 text-[11px]" /></td>
                    <td className="px-1 py-1"><Input type="number" step="any" value={p.minimo ?? ""} onChange={(e) => setP(i, { minimo: e.target.value === "" ? null : Number(e.target.value) })} className="h-7 text-[11px] text-right" /></td>
                    <td className="px-1 py-1"><Input type="number" step="any" value={p.maximo ?? ""} onChange={(e) => setP(i, { maximo: e.target.value === "" ? null : Number(e.target.value) })} className="h-7 text-[11px] text-right" /></td>
                    <td className="px-1 py-1 text-center"><Checkbox checked={p.obligatorio} onCheckedChange={(v) => setP(i, { obligatorio: !!v })} /></td>
                    <td className="px-1 py-1"><Input value={p.metodo} onChange={(e) => setP(i, { metodo: e.target.value })} className="h-7 text-[11px]" /></td>
                    <td className="px-1 py-1">
                      <div className="flex gap-0.5 justify-end">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => { if (i > 0) { const n = params.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; setParams(n); } }}><ArrowUp className="size-3" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => { if (i < params.length - 1) { const n = params.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; setParams(n); } }}><ArrowDown className="size-3" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => { const n = params.slice(); n.splice(i, 1); setParams(n); }}><Trash2 className="size-3 text-state-incidencia" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <datalist id="plant-param-suggest">
            {PARAMETROS_ANALITICA.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="size-4 mr-1" /> Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !nombre.trim()}>
            <Save className="size-4 mr-1" /> Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
