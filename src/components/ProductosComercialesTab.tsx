import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listProductosComerciales,
  upsertProductoComercial,
  deleteProductoComercial,
} from "@/lib/api/productos-comerciales.functions";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Props { bodegaId: string }

interface Prod {
  id: string;
  codigo: string;
  nombre: string;
  campaña: string | null;
  tipo: string | null;
  color: string | null;
  grado_referencia: number | null;
  activo: boolean;
}

export function ProductosComercialesTab({ bodegaId }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listProductosComerciales);
  const upsert = useServerFn(upsertProductoComercial);
  const del = useServerFn(deleteProductoComercial);

  const q = useQuery({
    queryKey: ["productos-comerciales", bodegaId],
    queryFn: () => list({ data: { bodegaId } }),
  });
  const productos = (q.data ?? []) as Prod[];

  const [editing, setEditing] = useState<Prod | null>(null);
  const [open, setOpen] = useState(false);

  const upsertM = useMutation({
    mutationFn: (vars: { id?: string; data: any }) =>
      upsert({ data: { bodegaId, id: vars.id, data: vars.data } }),
    onSuccess: () => {
      toast.success("Producto guardado");
      qc.invalidateQueries({ queryKey: ["productos-comerciales", bodegaId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { bodegaId, id } }),
    onSuccess: () => {
      toast.success("Producto eliminado");
      qc.invalidateQueries({ queryKey: ["productos-comerciales", bodegaId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display">Productos comerciales</h3>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3.5" /> Nuevo
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="text-left p-2">Código</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Campaña</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Color</th>
              <th className="text-right p-2">Grado ref.</th>
              <th className="text-center p-2">Activo</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{p.codigo}</td>
                <td className="p-2">{p.nombre}</td>
                <td className="p-2 text-muted-foreground">{p.campaña ?? "—"}</td>
                <td className="p-2 text-muted-foreground">{p.tipo ?? "—"}</td>
                <td className="p-2 text-muted-foreground">{p.color ?? "—"}</td>
                <td className="p-2 text-right">{p.grado_referencia ?? "—"}</td>
                <td className="p-2 text-center">{p.activo ? "✓" : "—"}</td>
                <td className="p-2 text-right">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="p-1 hover:bg-secondary rounded">
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Eliminar ${p.nombre}?`)) delM.mutate(p.id); }}
                    className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!productos.length && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground text-xs">No hay productos. Crea el primero.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ProductoDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSave={(d) => upsertM.mutate({ id: editing?.id, data: d })}
      />
    </div>
  );
}

function ProductoDialog({
  open, onOpenChange, initial, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial: Prod | null; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    codigo: initial?.codigo ?? "",
    nombre: initial?.nombre ?? "",
    campaña: initial?.campaña ?? "",
    tipo: initial?.tipo ?? "",
    color: initial?.color ?? "",
    grado_referencia: initial?.grado_referencia?.toString() ?? "",
    activo: initial?.activo ?? true,
  });
  useMemo(() => {
    if (open) setForm({
      codigo: initial?.codigo ?? "",
      nombre: initial?.nombre ?? "",
      campaña: initial?.campaña ?? "",
      tipo: initial?.tipo ?? "",
      color: initial?.color ?? "",
      grado_referencia: initial?.grado_referencia?.toString() ?? "",
      activo: initial?.activo ?? true,
    });
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Row label="Código"><Input value={form.codigo} onChange={(v) => setForm((s) => ({ ...s, codigo: v.toUpperCase() }))} /></Row>
          <Row label="Nombre"><Input value={form.nombre} onChange={(v) => setForm((s) => ({ ...s, nombre: v }))} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Campaña"><Input value={form.campaña ?? ""} onChange={(v) => setForm((s) => ({ ...s, campaña: v }))} /></Row>
            <Row label="Tipo"><Input value={form.tipo ?? ""} onChange={(v) => setForm((s) => ({ ...s, tipo: v }))} placeholder="tinto, blanco…" /></Row>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Color / Variedad"><Input value={form.color ?? ""} onChange={(v) => setForm((s) => ({ ...s, color: v }))} /></Row>
            <Row label="Grado ref."><Input value={form.grado_referencia} onChange={(v) => setForm((s) => ({ ...s, grado_referencia: v }))} placeholder="12.5" /></Row>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />
            Activo
          </label>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button
            disabled={!form.codigo.trim() || !form.nombre.trim()}
            onClick={() => onSave({
              codigo: form.codigo.trim(),
              nombre: form.nombre.trim(),
              campaña: form.campaña?.trim() || null,
              tipo: form.tipo?.trim() || null,
              color: form.color?.trim() || null,
              grado_referencia: form.grado_referencia ? Number(form.grado_referencia) : null,
              activo: form.activo,
            })}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >Guardar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm"
    />
  );
}
