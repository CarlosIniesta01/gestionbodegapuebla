import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listClientes, upsertCliente, deleteCliente,
  listProveedores, upsertProveedor, deleteProveedor,
} from "@/lib/api/contratos.functions";

interface Props { bodegaId: string; tipo: "cliente" | "proveedor" }

const cls = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm";

export function PartesTab({ bodegaId, tipo }: Props) {
  const qc = useQueryClient();
  const isCliente = tipo === "cliente";
  const listFn = useServerFn(isCliente ? listClientes : listProveedores);
  const upsertFn = useServerFn(isCliente ? upsertCliente : upsertProveedor);
  const deleteFn = useServerFn(isCliente ? deleteCliente : deleteProveedor);
  const key = isCliente ? "clientes" : "proveedores";

  const q = useQuery({
    queryKey: [key, bodegaId],
    queryFn: () => listFn({ data: { bodegaId } }),
  });
  const rows = (q.data ?? []) as any[];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const upsertM = useMutation({
    mutationFn: (p: { id?: string; data: any }) => upsertFn({ data: { bodegaId, id: p.id, data: p.data } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key, bodegaId] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { bodegaId, id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key, bodegaId] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display capitalize">{isCliente ? "Clientes" : "Proveedores"}</h3>
        <button onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="size-3.5" /> Nuevo
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">CIF/NIF</th>
              <th className="text-left p-2">Teléfono</th>
              <th className="text-left p-2">Email</th>
              <th className="text-right p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">Cargando…</td></tr>}
            {!q.isLoading && rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">Sin registros</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 font-medium">{r.nombre}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.cif_nif ?? "—"}</td>
                <td className="p-2 text-xs">{r.telefono ?? "—"}</td>
                <td className="p-2 text-xs">{r.email ?? "—"}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button onClick={() => { setEditing(r); setOpen(true); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                  <button onClick={() => { if (confirm(`¿Eliminar ${r.nombre}?`)) delM.mutate(r.id); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-rose-500"><Trash2 className="size-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ParteFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={(d) => upsertM.mutate({ id: editing?.id, data: d })}
      />
    </div>
  );
}

function ParteFormDialog({ open, onOpenChange, editing, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: any | null; onSave: (d: any) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cif, setCif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");

  if (open && editing && nombre === "" && editing.nombre) {
    // seed
    setNombre(editing.nombre ?? "");
    setCif(editing.cif_nif ?? "");
    setDireccion(editing.direccion ?? "");
    setTel(editing.telefono ?? "");
    setEmail(editing.email ?? "");
    setObs(editing.observaciones ?? "");
  }
  if (!open && nombre !== "") {
    setNombre(""); setCif(""); setDireccion(""); setTel(""); setEmail(""); setObs("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Nuevo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <L label="Nombre *"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={cls} /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="CIF/NIF"><input value={cif} onChange={(e) => setCif(e.target.value)} className={cls} /></L>
            <L label="Teléfono"><input value={tel} onChange={(e) => setTel(e.target.value)} className={cls} /></L>
          </div>
          <L label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={cls} /></L>
          <L label="Dirección"><input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={cls} /></L>
          <L label="Observaciones"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={cls} /></L>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button disabled={!nombre.trim()} onClick={() => onSave({
            nombre: nombre.trim(),
            cif_nif: cif.trim() || null,
            direccion: direccion.trim() || null,
            telefono: tel.trim() || null,
            email: email.trim() || null,
            observaciones: obs.trim() || null,
          })} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Guardar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
