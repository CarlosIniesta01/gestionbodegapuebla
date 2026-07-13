import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  listProcesosDoc, upsertProcesoDoc, deleteProcesoDoc,
} from "@/lib/api/procesos-doc.functions";

const CATEGORIAS = ["", "vino_tinto", "vino_blanco", "mosto", "alcohol", "producto_terminado", "otro"];

export function ProcesosDocumentalesTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listProcesosDoc);
  const upsertFn = useServerFn(upsertProcesoDoc);
  const deleteFn = useServerFn(deleteProcesoDoc);

  const q = useQuery({
    queryKey: ["admin-procesos-doc", bodegaId],
    queryFn: () => listFn({ data: { bodegaId, soloActivos: false } }),
    enabled: !!bodegaId,
  });

  const [editing, setEditing] = React.useState<any | null>(null);
  const [open, setOpen] = React.useState(false);

  const delM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-procesos-doc"] });
      qc.invalidateQueries({ queryKey: ["procesos-doc"] });
      toast.success("Proceso eliminado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const rows = q.data ?? [];

  return (
    <div className="rounded-xl border bg-card p-4 md:p-6" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-lg">Procesos documentales</h2>
          <p className="text-xs text-muted-foreground">
            Catálogo de procesos de carga y descarga usados en las órdenes.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1" /> Nuevo proceso
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Sin procesos configurados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-b">
                <th className="text-left py-2">Código</th>
                <th className="text-left py-2">Nombre</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Categoría</th>
                <th className="text-left py-2">Versión</th>
                <th className="text-left py-2">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{r.codigo}{r.es_default && <Badge variant="outline" className="ml-1 text-[9px]">default</Badge>}</td>
                  <td className="py-2">{r.nombre}</td>
                  <td className="py-2 capitalize">{r.tipo}</td>
                  <td className="py-2 text-xs text-muted-foreground">{r.categoria_producto ?? "—"}</td>
                  <td className="py-2 text-xs">v{r.version}</td>
                  <td className="py-2 text-xs">{r.activo ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</td>
                  <td className="py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm(`¿Eliminar ${r.codigo}?`) && delM.mutate(r.id)}>
                      <Trash2 className="size-3.5 text-state-incidencia" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProcesoEditor
        open={open}
        onOpenChange={setOpen}
        bodegaId={bodegaId}
        initial={editing}
        upsertFn={upsertFn}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-procesos-doc"] });
          qc.invalidateQueries({ queryKey: ["procesos-doc"] });
        }}
      />
    </div>
  );
}

function ProcesoEditor({ open, onOpenChange, bodegaId, initial, upsertFn, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  initial: any | null;
  upsertFn: any;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [tipo, setTipo] = React.useState<"carga" | "descarga">("carga");
  const [cat, setCat] = React.useState<string>("");
  const [descripcion, setDescripcion] = React.useState("");
  const [activo, setActivo] = React.useState(true);
  const [esDefault, setEsDefault] = React.useState(false);
  const [version, setVersion] = React.useState("1");

  React.useEffect(() => {
    if (!open) return;
    setCodigo(initial?.codigo ?? "");
    setNombre(initial?.nombre ?? "");
    setTipo(initial?.tipo ?? "carga");
    setCat(initial?.categoria_producto ?? "");
    setDescripcion(initial?.descripcion ?? "");
    setActivo(initial?.activo ?? true);
    setEsDefault(initial?.es_default ?? false);
    setVersion(initial?.version ?? "1");
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: initial?.id ?? null,
          bodegaId,
          codigo, nombre, tipo,
          categoriaProducto: cat || null,
          descripcion: descripcion || null,
          activo, esDefault, version,
        },
      }),
    onSuccess: () => { toast.success("Proceso guardado"); onSaved(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar proceso" : "Nuevo proceso"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="DP-10-03/4" /></div>
          <div className="space-y-1"><Label className="text-xs">Versión</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} /></div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="carga">Carga</SelectItem><SelectItem value="descarga">Descarga</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Categoría de producto</Label>
            <Select value={cat || "__none__"} onValueChange={(v) => setCat(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => <SelectItem key={c || "__none__"} value={c || "__none__"}>{c || "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1"><Label className="text-xs">Descripción</Label><Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={activo} onCheckedChange={(v) => setActivo(!!v)} /> Activo</label>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={esDefault} onCheckedChange={(v) => setEsDefault(!!v)} /> Predeterminado</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="size-4 mr-1" /> Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !codigo || !nombre}>
            <Save className="size-4 mr-1" /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
