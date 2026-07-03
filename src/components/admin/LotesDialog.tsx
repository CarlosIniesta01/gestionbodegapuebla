import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Lock, Unlock, Trash2, AlertTriangle, FlaskConical } from "lucide-react";

import { listLotes, upsertLote, bloquearLote, deleteLote } from "@/lib/api/lotes.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AnaliticasLoteDialog } from "@/components/analiticas/AnaliticasLoteDialog";


const ESTADO_COLOR: Record<string, string> = {
  disponible: "border-emerald-500/50 text-emerald-600",
  agotado: "border-zinc-500/50 text-zinc-500",
  caducado: "border-rose-500/50 text-rose-600",
  bloqueado: "border-amber-500/50 text-amber-600",
};

export function LotesDialog({
  open, onOpenChange, bodegaId, producto, autoNew,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  bodegaId: string; producto: any | null; autoNew?: boolean;
}) {
  const qc = useQueryClient();
  const fnList = useServerFn(listLotes);
  const fnUpsert = useServerFn(upsertLote);
  const fnBloq = useServerFn(bloquearLote);
  const fnDel = useServerFn(deleteLote);

  const lotesQ = useQuery({
    queryKey: ["lotes", bodegaId, producto?.id],
    queryFn: () => fnList({ data: { bodegaId, producto_id: producto.id } }),
    enabled: !!producto?.id && open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lotes", bodegaId, producto?.id] });
    qc.invalidateQueries({ queryKey: ["stock", bodegaId] });
  };
  const mUpsert = useMutation({ mutationFn: fnUpsert, onSuccess: () => { toast.success("Lote guardado"); invalidate(); setForm(null); }, onError: (e: Error) => toast.error(e.message) });
  const mBloq = useMutation({ mutationFn: fnBloq, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });
  const mDel = useMutation({ mutationFn: fnDel, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });

  const [form, setForm] = React.useState<any | null>(null);
  const [analitica, setAnalitica] = React.useState<{ open: boolean; lote: any | null }>({ open: false, lote: null });


  React.useEffect(() => {
    if (open && autoNew && producto) {
      setForm({
        producto_id: producto.id, numero_lote: "",
        cantidad_inicial: 0, unidad: producto.unidad ?? "kg",
        fecha_recepcion: new Date().toISOString().slice(0, 10),
      });
    }
    if (!open) setForm(null);
  }, [open, autoNew, producto]);

  if (!producto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-surface border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Lotes — {producto.nombre}</DialogTitle>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {producto.categoria ?? "sin categoría"} · unidad {producto.unidad ?? "kg"}
          </div>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setForm({
            producto_id: producto.id, numero_lote: "",
            cantidad_inicial: 0, unidad: producto.unidad ?? "kg",
          })}>
            <Plus className="size-4 mr-1.5" /> Nuevo lote
          </Button>
        </div>

        {form && (
          <div className="scada-panel p-4 space-y-3">
            <div className="text-sm font-medium">{form.id ? "Editar lote" : "Nuevo lote"}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nº de lote *</Label>
                <Input value={form.numero_lote} onChange={(e) => setForm({ ...form, numero_lote: e.target.value })} />
              </div>
              <div><Label>Proveedor</Label>
                <Input value={form.proveedor ?? ""} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
              </div>
              <div><Label>Fecha recepción</Label>
                <Input type="date" value={form.fecha_recepcion ?? ""} onChange={(e) => setForm({ ...form, fecha_recepcion: e.target.value })} />
              </div>
              <div><Label>Fecha caducidad</Label>
                <Input type="date" value={form.fecha_caducidad ?? ""} onChange={(e) => setForm({ ...form, fecha_caducidad: e.target.value })} />
              </div>
              <div><Label>Cantidad inicial *</Label>
                <Input type="number" step="0.001" value={form.cantidad_inicial}
                  onChange={(e) => setForm({ ...form, cantidad_inicial: parseFloat(e.target.value) || 0 })}
                  disabled={!!form.id} />
              </div>
              <div><Label>Unidad *</Label>
                <Input value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} />
              </div>
              <div><Label>Coste unitario</Label>
                <Input type="number" step="0.0001" value={form.coste_unitario ?? ""}
                  onChange={(e) => setForm({ ...form, coste_unitario: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div><Label>Ubicación física</Label>
                <Input value={form.ubicacion ?? ""} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
              </div>
            </div>
            <div><Label>Observaciones</Label>
              <Textarea rows={2} value={form.observaciones ?? ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setForm(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => {
                if (!form.numero_lote.trim()) return toast.error("Nº de lote obligatorio");
                if (form.cantidad_inicial <= 0 && !form.id) return toast.error("Cantidad inicial > 0");
                const { id, producto_id, ...rest } = form;
                mUpsert.mutate({ data: { bodegaId, id, data: { producto_id, ...rest,
                  fecha_recepcion: rest.fecha_recepcion || null,
                  fecha_caducidad: rest.fecha_caducidad || null,
                } } });
              }} disabled={mUpsert.isPending}>Guardar</Button>
            </div>
          </div>
        )}

        <div className="scada-panel overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            Lotes registrados ({lotesQ.data?.length ?? 0})
          </div>
          {lotesQ.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : (lotesQ.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin lotes registrados</div>
          ) : (
            <div className="divide-y divide-border">
              {(lotesQ.data ?? []).map((l: any) => {
                const proximo = l.fecha_caducidad && new Date(l.fecha_caducidad).getTime() - Date.now() < 1000*60*60*24*30;
                return (
                  <div key={l.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm">{l.numero_lote}</div>
                      <div className="text-xs text-muted-foreground">
                        {Number(l.cantidad_disponible).toFixed(3)} / {Number(l.cantidad_inicial).toFixed(3)} {l.unidad}
                        {l.proveedor && <> · {l.proveedor}</>}
                        {l.fecha_caducidad && <> · cad. {l.fecha_caducidad}</>}
                        {l.ubicacion && <> · {l.ubicacion}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={ESTADO_COLOR[l.estado] ?? ""}>{l.estado}</Badge>
                      {proximo && l.estado === "disponible" && (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                          <AlertTriangle className="size-3 mr-1" /> próximo
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setForm(l)}>Editar</Button>
                      <Button variant="ghost" size="icon" title="Analíticas" onClick={() => setAnalitica({ open: true, lote: l })}>
                        <FlaskConical className="size-4" />
                      </Button>

                      {l.estado === "bloqueado" ? (
                        <Button variant="ghost" size="icon" title="Desbloquear" onClick={() => {
                          const m = prompt("Motivo del desbloqueo:"); if (!m) return;
                          mBloq.mutate({ data: { bodegaId, id: l.id, motivo: m, desbloquear: true } });
                        }}><Unlock className="size-4" /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Bloquear" onClick={() => {
                          const m = prompt("Motivo del bloqueo:"); if (!m) return;
                          mBloq.mutate({ data: { bodegaId, id: l.id, motivo: m } });
                        }}><Lock className="size-4" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                        if (!confirm("¿Eliminar lote? Solo es posible si no tiene consumos.")) return;
                        mDel.mutate({ data: { bodegaId, id: l.id } });
                      }}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
