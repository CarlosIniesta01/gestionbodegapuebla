import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { getTrabajo, getContextoPlanificacion, registrarUsoPreliminar } from "@/lib/api/trabajos.functions";
import { supabase } from "@/integrations/supabase/client";
import { decimalPositivo } from "@/lib/dosificacion";
import { validarUsoLote, type MultioperacionGuardada } from "@/lib/multioperacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlanificacionResumen } from "./PlanificacionResumen";

type UsoValue = { id: string; linea_id: string; lote_id: string; cantidad: string; caducidad: string };
export function ProductosOrden({ trabajoId }: { trabajoId: string }) {
  const getFn = useServerFn(getTrabajo), contextoFn = useServerFn(getContextoPlanificacion), saveFn = useServerFn(registrarUsoPreliminar);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["trabajo", trabajoId], queryFn: () => getFn({ data: { id: trabajoId } }) });
  const t = q.data?.trabajo;
  const multi = (t?.datos as any)?.multioperacion as MultioperacionGuardada | undefined;
  const contextoQ = useQuery({ queryKey: ["contexto-planificacion", t?.bodega_id], queryFn: () => contextoFn({ data: { bodegaId: t?.bodega_id ?? "" } }), enabled: !!t?.bodega_id && multi?.version === 1 });
  const ownQ = useQuery({ queryKey: ["b2-propia-asignacion", trabajoId], queryFn: async () => {
    const { data: user, error } = await supabase.auth.getUser();
    if (error || !user.user) return false;
    const { data, error: e } = await supabase.from("trabajo_trabajadores").select("id").eq("trabajo_id", trabajoId).eq("trabajador_id", user.user.id).eq("activa", true).in("estado_participacion", ["asignado", "aceptado", "en_proceso"]);
    if (e) throw new Error(e.message);
    return (data?.length ?? 0) > 0;
  }, enabled: multi?.version === 1 });
  const [usos, setUsos] = useState<UsoValue[]>([]), [registroId, setRegistroId] = useState<string | null>(null), [saving, setSaving] = useState(false);
  if (!t) return <div className="text-sm text-muted-foreground">Cargando orden…</div>;
  if (multi?.version !== 1) return <PlanificacionResumen datos={t.datos} />;
  const eventos = (q.data?.eventos ?? []).filter((e) => e.tipo === "b2_uso_preliminar");
  const editable = ownQ.data === true && ["pendiente", "en_curso"].includes(t.estado);
  const update = (id: string, patch: Partial<UsoValue>) => { setRegistroId(null); setUsos((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r)); };
  const loteNombre = (id: string) => contextoQ.data?.lotes.find((l) => l.id === id)?.numero_lote ?? id;
  async function guardar() {
    if (!multi || !contextoQ.data) return;
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const payload = usos.map((u) => {
        const linea = multi.productos.find((p) => p.id === u.linea_id);
        const lote = contextoQ.data.lotes.find((l) => l.id === u.lote_id && l.producto_id === linea?.producto_id);
        if (!linea || !lote) throw new Error("Selecciona un lote del producto de la línea");
        const cantidad = decimalPositivo(u.cantidad);
        validarUsoLote(cantidad, linea.unidad, { ...lote, unidad: lote.unidad ?? "", cantidad_disponible: Number(lote.cantidad_disponible ?? 0) }, u.caducidad, hoy);
        return { linea_id: u.linea_id, lote_id: u.lote_id, cantidad_real: cantidad, fecha_caducidad: u.caducidad };
      });
      const ref = registroId ?? crypto.randomUUID(); setRegistroId(ref); setSaving(true);
      await saveFn({ data: { trabajoId, registroId: ref, usos: payload } });
      setUsos([]); setRegistroId(null); toast.success("Lotes y cantidades guardados sin descontar almacén");
      await qc.invalidateQueries({ queryKey: ["trabajo", trabajoId] });
      qc.invalidateQueries({ queryKey: ["actividad"] });
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  return <section className="space-y-4" aria-label="Productos de la orden">
    <div className="flex flex-wrap justify-between gap-2 text-sm"><b>Trabajo #{trabajoId.slice(0, 8)}</b><span className="text-muted-foreground">Registro preliminar · Sin consumo confirmado</span></div>
    <div className="space-y-2">{multi.operaciones.map((o) => <details key={o.operacion_id} className="border-b pb-2"><summary className="text-sm cursor-pointer">{o.codigo} · {o.nombre}</summary><div className="pt-2"><PlanificacionResumen datos={{ planificacion: o.planificacion }} /></div></details>)}</div>
    {contextoQ.isError && <div role="alert" className="text-sm text-destructive">{contextoQ.error.message}</div>}
    <div className="max-w-full overflow-x-auto"><table className="w-full text-xs text-left"><thead className="text-muted-foreground"><tr>{["Nº trabajo / Operación", "Producto / Proveedor", "Ordenado", "Lotes / Real registrado"].map((h) => <th key={h} className="p-2 border-b">{h}</th>)}</tr></thead><tbody>{multi.productos.map((p) => {
      const registros = eventos.flatMap((e) => ((e.meta as any)?.usos ?? []).filter((u: any) => u.linea_id === p.id).map((u: any) => ({ ...u, user_id: e.user_id, fecha: e.created_at })));
      return <tr key={p.id} className="align-top"><td className="p-2 border-b">#{trabajoId.slice(0, 8)}<br />{multi.operaciones.find((o) => o.operacion_id === p.operacion_id)?.codigo}</td><td className="p-2 border-b font-medium">{p.nombre}<div className="font-normal text-muted-foreground">{p.proveedor ?? "—"}</div></td><td className="p-2 border-b whitespace-nowrap">{p.cantidad_prevista} {p.unidad}</td><td className="p-2 border-b">{registros.length ? registros.map((u: any, i: number) => <div key={i} className="mb-2">{loteNombre(u.lote_id)} · {u.cantidad_real} {p.unidad}<div className="text-muted-foreground">Cad.: {u.fecha_caducidad} · {new Date(u.fecha).toLocaleString("es-ES")} · Operario #{u.user_id.slice(0, 8)}</div></div>) : "Pendiente del operario"}{editable && <Button variant="ghost" size="sm" aria-label={`Añadir lote de ${p.nombre}`} onClick={() => { setRegistroId(null); setUsos((rows) => [...rows, { id: crypto.randomUUID(), linea_id: p.id, lote_id: "", cantidad: "", caducidad: "" }]); }}><Plus className="size-3 mr-1" />Lote</Button>}</td></tr>;
    })}</tbody></table></div>
    {usos.map((u, i) => {
      const linea = multi.productos.find((p) => p.id === u.linea_id), lote = contextoQ.data?.lotes.find((l) => l.id === u.lote_id);
      return <div key={u.id} className="border-b pb-3 space-y-2"><div className="flex justify-between gap-2 items-center"><b className="text-sm">{linea?.nombre}</b><Button variant="ghost" size="icon" aria-label={`Retirar lote pendiente ${i + 1}`} title="Retirar lote pendiente" disabled={saving} onClick={() => { setRegistroId(null); setUsos((rows) => rows.filter((r) => r.id !== u.id)); }}><Trash2 className="size-4" /></Button></div>
        <div className="grid sm:grid-cols-3 gap-2"><div><Label>Lote utilizado</Label><Select disabled={saving} value={u.lote_id || "__none"} onValueChange={(id) => { const l = contextoQ.data?.lotes.find((r) => r.id === id); update(u.id, { lote_id: id === "__none" ? "" : id, caducidad: l?.fecha_caducidad ?? "" }); }}><SelectTrigger aria-label={`Lote utilizado ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Seleccionar lote</SelectItem>{contextoQ.data?.lotes.filter((l) => l.producto_id === linea?.producto_id).map((l) => <SelectItem key={l.id} value={l.id}>{l.numero_lote} · {l.estado}</SelectItem>)}</SelectContent></Select></div><div><Label>Cantidad real ({linea?.unidad})</Label><Input disabled={saving} aria-label={`Cantidad real ${i + 1}`} inputMode="decimal" value={u.cantidad} onChange={(e) => update(u.id, { cantidad: e.target.value })} /></div><div><Label>Caducidad verificada</Label><Input disabled={saving || !!lote?.fecha_caducidad} type="date" aria-label={`Caducidad verificada ${i + 1}`} value={u.caducidad} onChange={(e) => update(u.id, { caducidad: e.target.value })} /></div></div>
        {lote && <div className="text-xs text-muted-foreground">Disponible: {lote.cantidad_disponible} {lote.unidad} · {lote.estado}</div>}
      </div>;
    })}
    {editable && usos.length > 0 && <Button disabled={saving || !contextoQ.data} onClick={guardar}><Save className="size-4 mr-2" />{saving ? "Guardando…" : "Guardar registro preliminar"}</Button>}
  </section>;
}