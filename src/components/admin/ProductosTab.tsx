import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Edit3, Trash2, Power, PowerOff, Beaker, Sparkles, Package, Boxes, FileText, PackagePlus } from "lucide-react";

import { listProductos, upsertProducto, toggleProductoActivo, deleteProducto } from "@/lib/api/productos.functions";
import { upsertLote } from "@/lib/api/lotes.functions";
import { LotesDialog } from "./LotesDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TIPOS = [
  { value: "enologico", label: "Enológico", icon: Beaker },
  { value: "limpieza", label: "Limpieza", icon: Sparkles },
  { value: "otro", label: "Otro", icon: Package },
];

const CATEGORIAS = [
  "levaduras","nutrientes","clarificantes","estabilizantes","enzimas",
  "limpieza","laboratorio","aditivos","consumibles","otro",
];

export function ProductosTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listProductos);
  const fnToggle = useServerFn(toggleProductoActivo);
  const fnDelete = useServerFn(deleteProducto);

  const listQ = useQuery({
    queryKey: ["admin", "productos", bodegaId],
    queryFn: () => fnList({ data: { bodegaId, soloActivos: false } }),
  });

  const [filtroTipo, setFiltroTipo] = React.useState<string>("all");
  const [filtroCat, setFiltroCat] = React.useState<string>("all");
  const [filtroActivos, setFiltroActivos] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [lotesFor, setLotesFor] = React.useState<any | null>(null);
  const [lotesAutoNew, setLotesAutoNew] = React.useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "productos", bodegaId] });
  const mToggle = useMutation({ mutationFn: fnToggle, onSuccess: invalidate });
  const mDelete = useMutation({
    mutationFn: fnDelete,
    onSuccess: () => { toast.success("Producto eliminado"); invalidate(); setConfirmDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (listQ.data ?? []).filter((p: any) => {
    if (filtroTipo !== "all" && p.tipo !== filtroTipo) return false;
    if (filtroCat !== "all" && p.categoria !== filtroCat) return false;
    if (filtroActivos && !p.activo) return false;
    if (busqueda && !`${p.nombre} ${p.fabricante ?? ""} ${p.referencia ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <Input placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="md:w-[220px]" />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setFiltroActivos((v) => !v)}>
          {filtroActivos ? "Mostrar todos" : "Solo activos"}
        </Button>
        <div className="md:ml-auto">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Nuevo producto
          </Button>
        </div>
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">
          Productos ({filtered.length})
        </div>
        {listQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Package className="size-8 mx-auto mb-2 opacity-50" />
            No hay productos. Crea el primero con el botón "Nuevo producto".
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p: any) => {
              const Tipo = TIPOS.find((t) => t.value === p.tipo);
              const TipoIcon = Tipo?.icon ?? Package;
              return (
                <div key={p.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="size-8 rounded bg-accent/40 flex items-center justify-center">
                      <TipoIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {p.nombre}
                        {p.referencia && <span className="ml-2 text-xs text-muted-foreground">[{p.referencia}]</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.categoria && <>{p.categoria} · </>}
                        {p.fabricante && <>{p.fabricante} · </>}
                        unidad {p.unidad ?? "kg"}
                        {p.stock_minimo != null && <> · mín {p.stock_minimo}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{Tipo?.label ?? p.tipo}</Badge>
                    {!p.activo && <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                    {(p.ficha_tecnica_url || p.ficha_seguridad_url) && (
                      <a href={p.ficha_tecnica_url || p.ficha_seguridad_url} target="_blank" rel="noreferrer"
                         className="p-2 hover:bg-accent rounded" title="Fichas">
                        <FileText className="size-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setLotesFor(p)} title="Lotes">
                      <Boxes className="size-4 mr-1" /> Lotes
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setDialogOpen(true); }} title="Editar">
                      <Edit3 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => mToggle.mutate({ data: { id: p.id, activo: !p.activo } })} title={p.activo ? "Desactivar" : "Activar"}>
                      {p.activo ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p.id)} title="Eliminar">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ProductoDialog
        open={dialogOpen} onOpenChange={setDialogOpen} bodegaId={bodegaId}
        producto={editing} onSaved={invalidate}
      />
      <LotesDialog open={!!lotesFor} onOpenChange={(v) => !v && setLotesFor(null)}
        bodegaId={bodegaId} producto={lotesFor} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              No podrás eliminarlo si tiene lotes o consumos asociados. En ese caso, desactívalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && mDelete.mutate({ data: { id: confirmDelete } })}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductoDialog({
  open, onOpenChange, bodegaId, producto, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; bodegaId: string;
  producto: any | null; onSaved: () => void;
}) {
  const fnUpsert = useServerFn(upsertProducto);
  const [f, setF] = React.useState<any>({});

  React.useEffect(() => {
    if (!open) return;
    setF(producto ? { ...producto } : {
      nombre: "", tipo: "enologico", categoria: "otro", unidad: "kg", activo: true,
    });
  }, [open, producto]);

  const m = useMutation({
    mutationFn: fnUpsert,
    onSuccess: () => { toast.success(producto ? "Producto actualizado" : "Producto creado"); onSaved(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!f.nombre?.trim()) return toast.error("El nombre es obligatorio");
    m.mutate({ data: {
      id: producto?.id, bodegaId,
      nombre: f.nombre.trim(),
      tipo: f.tipo ?? "enologico",
      categoria: f.categoria ?? null,
      fabricante: f.fabricante?.trim() || null,
      referencia: f.referencia?.trim() || null,
      unidad: f.unidad?.trim() || "kg",
      stock_minimo: f.stock_minimo != null && f.stock_minimo !== "" ? Number(f.stock_minimo) : null,
      stock_critico: f.stock_critico != null && f.stock_critico !== "" ? Number(f.stock_critico) : null,
      ficha_tecnica_url: f.ficha_tecnica_url?.trim() || null,
      ficha_seguridad_url: f.ficha_seguridad_url?.trim() || null,
      activo: !!f.activo,
      observaciones: f.observaciones?.trim() || undefined,
    } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producto ? "Editar producto" : "Nuevo producto enológico"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre *</Label>
            <Input value={f.nombre ?? ""} onChange={(e) => setF({ ...f, nombre: e.target.value })} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tipo</Label>
              <Select value={f.tipo ?? "enologico"} onValueChange={(v) => setF({ ...f, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Categoría</Label>
              <Select value={f.categoria ?? "otro"} onValueChange={(v) => setF({ ...f, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fabricante</Label>
              <Input value={f.fabricante ?? ""} onChange={(e) => setF({ ...f, fabricante: e.target.value })} />
            </div>
            <div><Label>Referencia</Label>
              <Input value={f.referencia ?? ""} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Unidad</Label>
              <Input value={f.unidad ?? "kg"} onChange={(e) => setF({ ...f, unidad: e.target.value })} />
            </div>
            <div><Label>Stock mínimo</Label>
              <Input type="number" step="0.001" value={f.stock_minimo ?? ""} onChange={(e) => setF({ ...f, stock_minimo: e.target.value })} />
            </div>
            <div><Label>Stock crítico</Label>
              <Input type="number" step="0.001" value={f.stock_critico ?? ""} onChange={(e) => setF({ ...f, stock_critico: e.target.value })} />
            </div>
          </div>
          <div><Label>Ficha técnica (URL)</Label>
            <Input value={f.ficha_tecnica_url ?? ""} onChange={(e) => setF({ ...f, ficha_tecnica_url: e.target.value })} placeholder="https://…" />
          </div>
          <div><Label>Ficha de seguridad (URL)</Label>
            <Input value={f.ficha_seguridad_url ?? ""} onChange={(e) => setF({ ...f, ficha_seguridad_url: e.target.value })} placeholder="https://…" />
          </div>
          <div><Label>Observaciones</Label>
            <Textarea rows={2} value={f.observaciones ?? ""} onChange={(e) => setF({ ...f, observaciones: e.target.value })} maxLength={500} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} />
            Activo
          </label>
          <p className="text-xs text-muted-foreground">
            Los lotes se gestionan desde el botón <strong>Lotes</strong> de cada producto.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
