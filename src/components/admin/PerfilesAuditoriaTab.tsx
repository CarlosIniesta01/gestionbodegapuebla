import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Star } from "lucide-react";
import {
  listPerfilesAuditoria,
  upsertPerfilAuditoria,
  deletePerfilAuditoria,
  duplicarPerfilAuditoria,
} from "@/lib/api/auditoria.functions";
import { CAMPOS_AUDITORIA } from "@/lib/auditoria-fields";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Perfil {
  id: string;
  nombre: string;
  descripcion: string | null;
  campos_visibles: string[];
  filtros: Record<string, any>;
  es_predeterminado: boolean;
}

export function PerfilesAuditoriaTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listPerfilesAuditoria);
  const fnUpsert = useServerFn(upsertPerfilAuditoria);
  const fnDel = useServerFn(deletePerfilAuditoria);
  const fnDup = useServerFn(duplicarPerfilAuditoria);

  const q = useQuery({
    queryKey: ["perfiles-auditoria", bodegaId],
    queryFn: () => fnList({ data: { bodegaId } }),
  });
  const perfiles = (q.data ?? []) as Perfil[];

  const [editing, setEditing] = useState<Perfil | null>(null);
  const [open, setOpen] = useState(false);

  const upsertM = useMutation({
    mutationFn: (vars: { id?: string; data: any }) =>
      fnUpsert({ data: { bodegaId, id: vars.id, data: vars.data } }),
    onSuccess: () => { toast.success("Perfil guardado"); qc.invalidateQueries({ queryKey: ["perfiles-auditoria", bodegaId] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => fnDel({ data: { bodegaId, id } }),
    onSuccess: () => { toast.success("Perfil eliminado"); qc.invalidateQueries({ queryKey: ["perfiles-auditoria", bodegaId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const dupM = useMutation({
    mutationFn: (id: string) => fnDup({ data: { bodegaId, id } }),
    onSuccess: () => { toast.success("Perfil duplicado"); qc.invalidateQueries({ queryKey: ["perfiles-auditoria", bodegaId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Perfiles de auditoría</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            La base de datos conserva siempre todos los datos. Los perfiles solo deciden qué campos se muestran o exportan.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="size-3.5" /> Nuevo perfil
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Descripción</th>
              <th className="text-center p-2">Campos</th>
              <th className="text-center p-2">Defecto</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2 font-medium">{p.nombre}</td>
                <td className="p-2 text-muted-foreground">{p.descripcion ?? "—"}</td>
                <td className="p-2 text-center text-xs">{(p.campos_visibles ?? []).length}</td>
                <td className="p-2 text-center">{p.es_predeterminado && <Star className="size-3.5 inline fill-current text-amber-500" />}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="p-1 hover:bg-secondary rounded" title="Editar">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => dupM.mutate(p.id)} className="p-1 hover:bg-secondary rounded ml-1" title="Duplicar">
                    <Copy className="size-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(`Eliminar perfil ${p.nombre}?`)) delM.mutate(p.id); }}
                    className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1" title="Eliminar">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!perfiles.length && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">
                No hay perfiles. Crea uno para definir qué se muestra en la auditoría.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PerfilDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSave={(d) => upsertM.mutate({ id: editing?.id, data: d })}
      />
    </div>
  );
}

function PerfilDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: Perfil | null;
  onSave: (d: any) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [campos, setCampos] = useState<string[]>([]);
  const [pred, setPred] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(initial?.nombre ?? "");
      setDescripcion(initial?.descripcion ?? "");
      setCampos(initial?.campos_visibles ?? []);
      setPred(initial?.es_predeterminado ?? false);
    }
  }, [open, initial]);

  const toggle = (k: string) =>
    setCampos((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Editar perfil" : "Nuevo perfil de auditoría"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Nombre</div>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Auditoría comercial"
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Descripción</div>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pred} onChange={(e) => setPred(e.target.checked)} />
            Establecer como perfil por defecto
          </label>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
              Campos visibles ({campos.length} seleccionados)
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button type="button" onClick={() => setCampos(CAMPOS_AUDITORIA.map((c) => c.key))}
                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary">Todos</button>
              <button type="button" onClick={() => setCampos([])}
                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary">Ninguno</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 rounded-lg border border-border p-3 max-h-72 overflow-y-auto">
              {CAMPOS_AUDITORIA.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={campos.includes(c.key)} onChange={() => toggle(c.key)} />
                  <span>{c.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{c.key}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button
            disabled={!nombre.trim()}
            onClick={() => onSave({
              nombre: nombre.trim(),
              descripcion: descripcion.trim() || null,
              campos_visibles: campos,
              filtros: {},
              es_predeterminado: pred,
            })}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Guardar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
