import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Ban } from "lucide-react";

import { listConsumos, createConsumo, anularConsumo, listLotes, trabajoConsumosCompletos } from "@/lib/api/lotes.functions";
import { listProductos } from "@/lib/api/productos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConsumosTab({ bodegaId, trabajoId }: { bodegaId: string; trabajoId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listConsumos);
  const fnCreate = useServerFn(createConsumo);
  const fnAnular = useServerFn(anularConsumo);
  const fnProductos = useServerFn(listProductos);
  const fnLotes = useServerFn(listLotes);

  const consumosQ = useQuery({
    queryKey: ["consumos", bodegaId, trabajoId],
    queryFn: () => fnList({ data: { bodegaId, trabajo_id: trabajoId } }),
  });
  const productosQ = useQuery({
    queryKey: ["productos-activos", bodegaId],
    queryFn: () => fnProductos({ data: { bodegaId, soloActivos: true } }),
  });

  const [productoId, setProductoId] = React.useState<string>("");
  const [loteId, setLoteId] = React.useState<string>("");
  const [cantidad, setCantidad] = React.useState<string>("");
  const [autorizarCaducado, setAutorizarCaducado] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const lotesQ = useQuery({
    queryKey: ["lotes", bodegaId, productoId],
    queryFn: () => fnLotes({ data: { bodegaId, producto_id: productoId } }),
    enabled: !!productoId,
  });

  const producto = (productosQ.data ?? []).find((p: any) => p.id === productoId);
  const lote = (lotesQ.data ?? []).find((l: any) => l.id === loteId);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["consumos", bodegaId, trabajoId] });
  const m = useMutation({ mutationFn: fnCreate, onSuccess: () => {
    toast.success("Consumo registrado"); invalidate();
    setProductoId(""); setLoteId(""); setCantidad(""); setAutorizarCaducado(false); setMotivo("");
  }, onError: (e: Error) => toast.error(e.message) });
  const mAnular = useMutation({ mutationFn: fnAnular, onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });

  function submit() {
    if (!productoId || !loteId) return toast.error("Producto y lote obligatorios");
    const c = parseFloat(cantidad);
    if (!c || c <= 0) return toast.error("Cantidad obligatoria > 0");
    m.mutate({ data: { bodegaId, data: {
      producto_id: productoId, lote_id: loteId, cantidad: c,
      unidad: lote?.unidad ?? producto?.unidad ?? "kg",
      trabajo_id: trabajoId,
      uso_caducado_autorizado: autorizarCaducado,
      motivo_autorizacion: autorizarCaducado ? motivo : null,
    } } });
  }

  return (
    <div className="space-y-3">
      <div className="scada-panel p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Registrar consumo</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Producto</Label>
            <Select value={productoId} onValueChange={(v) => { setProductoId(v); setLoteId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {(productosQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Lote</Label>
            <Select value={loteId} onValueChange={setLoteId} disabled={!productoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona lote…" /></SelectTrigger>
              <SelectContent>
                {(lotesQ.data ?? []).map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.numero_lote} — disp. {Number(l.cantidad_disponible).toFixed(3)} {l.unidad} [{l.estado}]
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cantidad ({lote?.unidad ?? producto?.unidad ?? "—"})</Label>
            <Input type="number" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={submit} disabled={m.isPending} className="w-full">
              <Plus className="size-4 mr-1" /> Registrar
            </Button>
          </div>
        </div>
        {lote && (lote.estado === "caducado" || (lote.fecha_caducidad && new Date(lote.fecha_caducidad) < new Date())) && (
          <div className="border border-rose-500/40 bg-rose-500/5 rounded p-2 space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={autorizarCaducado} onChange={(e) => setAutorizarCaducado(e.target.checked)} />
              Autorizar uso de lote caducado (enólogo / responsable)
            </label>
            {autorizarCaducado && (
              <Input placeholder="Motivo de la autorización" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            )}
          </div>
        )}
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-3 py-2 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
          Consumos del trabajo ({consumosQ.data?.length ?? 0})
        </div>
        {consumosQ.isLoading ? (
          <div className="p-3 text-sm text-muted-foreground">Cargando…</div>
        ) : (consumosQ.data ?? []).length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Sin consumos</div>
        ) : (
          <div className="divide-y divide-border">
            {(consumosQ.data ?? []).map((c: any) => (
              <div key={c.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className={c.anulado ? "line-through text-muted-foreground" : "font-medium"}>
                    {c.productos?.nombre} · lote {c.producto_lotes?.numero_lote}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(c.cantidad).toFixed(3)} {c.unidad} · {c.fecha} {c.hora?.slice(0,5)}
                    {c.uso_caducado_autorizado && " · ⚠ caducado autorizado"}
                  </div>
                </div>
                {c.anulado ? (
                  <Badge variant="outline" className="text-rose-600 border-rose-500/40">anulado</Badge>
                ) : (
                  <Button variant="ghost" size="icon" title="Anular" onClick={() => {
                    const m = prompt("Motivo de la anulación:"); if (!m) return;
                    mAnular.mutate({ data: { bodegaId, id: c.id, motivo: m } });
                  }}><Ban className="size-4 text-rose-600" /></Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
