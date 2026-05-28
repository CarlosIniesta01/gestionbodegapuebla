import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Edit3, Trash2, Power, PowerOff, Beaker, Sparkles, Package } from "lucide-react";

import { listProductos, upsertProducto, toggleProductoActivo, deleteProducto } from "@/lib/api/productos.functions";

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
  const [filtroActivos, setFiltroActivos] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "productos", bodegaId] });

  const mToggle = useMutation({ mutationFn: fnToggle, onSuccess: invalidate });
  const mDelete = useMutation({
    mutationFn: fnDelete,
    onSuccess: () => { toast.success("Producto eliminado"); invalidate(); setConfirmDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (listQ.data ?? []).filter((p: any) => {
    if (filtroTipo !== "all" && p.tipo !== filtroTipo) return false;
    if (filtroActivos && !p.activo) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
            No hay productos. Crea el primero con el botón “Nuevo producto”.
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
                      <div className="font-medium text-sm truncate">{p.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Lote: <strong>{p.lote}</strong>
                        {p.proveedor && <> · {p.proveedor}</>}
                        {p.fecha_caducidad && <> · cad. {p.fecha_caducidad}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{Tipo?.label ?? p.tipo}</Badge>
                    {!p.activo && <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bodegaId={bodegaId}
        producto={editing}
        onSaved={invalidate}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              No podrás eliminarlo si está siendo usado por alguna receta. En ese caso, desactívalo.
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
  const [nombre, setNombre] = React.useState("");
  const [tipo, setTipo] = React.useState<"enologico" | "limpieza" | "otro">("enologico");
  const [lote, setLote] = React.useState("");
  const [proveedor, setProveedor] = React.useState("");
  const [caducidad, setCaducidad] = React.useState("");
  const [activo, setActivo] = React.useState(true);
  const [observaciones, setObservaciones] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (producto) {
      setNombre(producto.nombre ?? "");
      setTipo(producto.tipo ?? "enologico");
      setLote(producto.lote ?? "");
      setProveedor(producto.proveedor ?? "");
      setCaducidad(producto.fecha_caducidad ?? "");
      setActivo(producto.activo ?? true);
      setObservaciones(producto.observaciones ?? "");
    } else {
      setNombre(""); setTipo("enologico"); setLote(""); setProveedor("");
      setCaducidad(""); setActivo(true); setObservaciones("");
    }
  }, [open, producto]);

  const m = useMutation({
    mutationFn: fnUpsert,
    onSuccess: () => { toast.success(producto ? "Producto actualizado" : "Producto creado"); onSaved(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");
    if (!lote.trim()) return toast.error("Debes indicar el lote del producto para continuar.");
    m.mutate({
      data: {
        id: producto?.id, bodegaId, nombre: nombre.trim(), tipo,
        lote: lote.trim(), proveedor: proveedor.trim() || undefined,
        fecha_caducidad: caducidad || undefined, activo,
        observaciones: observaciones.trim() || undefined,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{producto ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lote *</Label>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} maxLength={120} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Proveedor (opcional)</Label>
              <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label>Caducidad (opcional)</Label>
              <Input type="date" value={caducidad} onChange={(e) => setCaducidad(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observaciones</Label>
            <Textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Activo
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
