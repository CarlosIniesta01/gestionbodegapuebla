import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlanificacionFields, construirPlanificacion, PLANIFICACION_VACIA, type PlanificacionValue } from "./PlanificacionFields";
import { plantillaParaOperacion, validarRelacionesPlan, type ContextoPlanificacion } from "@/lib/plantillas-trabajo";
import { compatibles, validarMultioperacion, type MultioperacionInput } from "@/lib/multioperacion";
import { decimalPositivo } from "@/lib/dosificacion";
import type { Operacion } from "@/lib/operaciones-meta";

export type MultiValue = { operaciones: { operacion: Operacion; value: PlanificacionValue }[]; productos: { id: string; operacion_id: string; producto_id: string; cantidad: string; unidad: "kg" | "L" }[] };
export function inicialMulti(op: Operacion): MultiValue { return { operaciones: [{ operacion: op, value: PLANIFICACION_VACIA }], productos: [] }; }
export function construirMulti(value: MultiValue): MultioperacionInput {
  return { version: 1, operaciones: value.operaciones.map((o) => {
    const plantilla = plantillaParaOperacion(o.operacion);
    if (!plantilla) throw new Error("Operación pendiente de formulario compatible");
    return { operacion_id: o.operacion.id, planificacion: construirPlanificacion(plantilla, { ...o.value, productos: [] }) };
  }), productos: value.productos.map((p) => ({ id: p.id, operacion_id: p.operacion_id, producto_id: p.producto_id, cantidad_prevista: decimalPositivo(p.cantidad), unidad: p.unidad })) };
}
export function errorMulti(value: MultiValue, contexto: ContextoPlanificacion, origen: string, destino: string): string | null {
  try {
    const principal = value.operaciones[0]?.operacion;
    if (!principal) throw new Error("Selecciona el trabajo principal");
    const { planes } = validarMultioperacion(construirMulti(value), principal, value.operaciones.map((o) => o.operacion), contexto);
    for (const p of planes) validarRelacionesPlan(p, contexto, origen, destino);
    return null;
  } catch (e) { return e instanceof Error && e.name !== "ZodError" ? e.message : "Revisa operaciones, productos y cantidades previstas"; }
}

export function MultioperacionFields({ value, onChange, contexto, disponibles, origen, destino, onOrigenChange, onDestinoChange }: {
  value: MultiValue; onChange: (v: MultiValue) => void; contexto: ContextoPlanificacion; disponibles: Operacion[];
  origen: string; destino: string; onOrigenChange: (v: string) => void; onDestinoChange: (v: string) => void;
}) {
  const principal = value.operaciones[0]?.operacion;
  if (!principal) return null;
  const candidatas = disponibles.filter((o) => compatibles(principal, o) && !value.operaciones.some((r) => r.operacion.id === o.id));
  const updateProduct = (id: string, patch: Partial<MultiValue["productos"][number]>) => onChange({ ...value, productos: value.productos.map((p) => p.id === id ? { ...p, ...patch } : p) });
  return <div className="space-y-4">
    <div><Label>Operaciones relacionadas</Label><Select value="__none" onValueChange={(id) => {
      const op = candidatas.find((o) => o.id === id);
      if (op) onChange({ ...value, operaciones: [...value.operaciones, { operacion: op, value: { ...PLANIFICACION_VACIA, litros: value.operaciones[0]?.value.litros ?? "" } }] });
    }}><SelectTrigger aria-label="Añadir operación relacionada"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Añadir operación</SelectItem>{candidatas.map((o) => <SelectItem key={o.id} value={o.id}>{o.codigo} · {o.nombre}</SelectItem>)}</SelectContent></Select></div>
    {value.operaciones.map((o, i) => {
      const plantilla = plantillaParaOperacion(o.operacion);
      if (!plantilla) return null;
      return <section key={o.operacion.id} className="border-t border-border pt-3 space-y-3">
        <div className="flex justify-between items-center gap-2"><h3 className="font-medium text-sm break-words">{i + 1}. {o.operacion.codigo} · {o.operacion.nombre}{i === 0 ? " · Principal" : ""}</h3>{i > 0 && <Button variant="ghost" size="icon" aria-label={`Retirar operación ${i + 1}`} title="Retirar operación" onClick={() => onChange({ operaciones: value.operaciones.filter((r) => r !== o), productos: value.productos.filter((p) => p.operacion_id !== o.operacion.id) })}><Trash2 className="size-4" /></Button>}</div>
        <PlanificacionFields plantilla={plantilla} contexto={contexto} origen={origen} destino={destino} onOrigenChange={onOrigenChange} onDestinoChange={onDestinoChange} value={o.value} ocultarProductos onChange={(next) => onChange({ ...value, operaciones: value.operaciones.map((r) => ({ ...r, value: r === o ? next : { ...r.value, litros: next.litros } })) })} />
      </section>;
    })}
    {plantillaParaOperacion(principal) !== "trasiego" && <section className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap justify-between gap-2 items-center"><h3 className="font-medium text-sm">Productos ordenados</h3><Button variant="outline" size="sm" onClick={() => onChange({ ...value, productos: [...value.productos, { id: crypto.randomUUID(), operacion_id: principal.id, producto_id: "", cantidad: "", unidad: "kg" }] })}><Plus className="size-4 mr-1" />Añadir producto</Button></div>
      {value.productos.map((p, i) => {
        const producto = contexto.productos.find((r) => r.id === p.producto_id);
        return <div key={p.id} className="border-b pb-3 space-y-2">
          <div className="flex justify-between items-center"><span className="text-xs font-medium">Producto ordenado {i + 1}</span><Button variant="ghost" size="icon" aria-label={`Retirar producto ordenado ${i + 1}`} title="Retirar producto" onClick={() => onChange({ ...value, productos: value.productos.filter((r) => r.id !== p.id) })}><Trash2 className="size-4" /></Button></div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div><Label>Operación</Label><Select value={p.operacion_id} onValueChange={(v) => updateProduct(p.id, { operacion_id: v })}><SelectTrigger aria-label={`Operación del producto ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{value.operaciones.map((o) => <SelectItem key={o.operacion.id} value={o.operacion.id}>{o.operacion.codigo} · {o.operacion.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Producto enológico</Label><Select value={p.producto_id || "__none"} onValueChange={(v) => updateProduct(p.id, { producto_id: v === "__none" ? "" : v })}><SelectTrigger aria-label={`Producto ordenado ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Seleccionar producto</SelectItem>{contexto.productos.filter((r) => r.tipo === "enologico").map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Cantidad prevista</Label><Input aria-label={`Cantidad prevista ${i + 1}`} inputMode="decimal" value={p.cantidad} onChange={(e) => updateProduct(p.id, { cantidad: e.target.value })} /></div>
            <div><Label>Unidad</Label><Select value={p.unidad} onValueChange={(v) => updateProduct(p.id, { unidad: v as "kg" | "L" })}><SelectTrigger aria-label={`Unidad prevista ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="L">L</SelectItem></SelectContent></Select></div>
          </div><div className="text-xs text-muted-foreground">Proveedor: {producto?.proveedor ?? "Sin proveedor registrado"} · Lote y caducidad: pendientes del operario</div>
        </div>;
      })}
    </section>}
  </div>;
}