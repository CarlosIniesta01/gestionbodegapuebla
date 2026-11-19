import { Plus, Trash2 } from "lucide-react";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcularDosificacion, decimalPositivo, UNIDADES_CANTIDAD, UNIDADES_DOSIS, type UnidadDosis, type UnidadCantidad } from "@/lib/dosificacion";
import { PLANTILLAS_TRABAJO, validarPlanificacion, validarRelacionesPlan, type ContextoPlanificacion, type PlantillaId, type PlanificacionInput } from "@/lib/plantillas-trabajo";

export type ProductoDosisValue = { id: string; producto_id: string; lote_id: string; dosis: string; unidad_dosis: UnidadDosis; unidad_cantidad: UnidadCantidad; densidad: string };
export type PlanificacionValue = { litros: string; parametros: Record<string, string>; productos: ProductoDosisValue[] };
export const PLANIFICACION_VACIA: PlanificacionValue = { litros: "", parametros: {}, productos: [] };

export function construirPlanificacion(plantilla: PlantillaId, value: PlanificacionValue): PlanificacionInput {
  for (const [i, p] of value.productos.entries()) {
    if (!p.producto_id) throw new Error(`Selecciona el producto ${i + 1}`);
    if (!p.lote_id) throw new Error(`Selecciona el lote del producto ${i + 1}`);
  }
  return validarPlanificacion({
    plantilla_id: plantilla, plantilla_version: PLANTILLAS_TRABAJO[plantilla].version, naturaleza: "prevision",
    litros_previstos: decimalPositivo(value.litros),
    parametros: Object.fromEntries(PLANTILLAS_TRABAJO[plantilla].campos.filter((c) => value.parametros[c.key]?.trim()).map((c) => [c.key, {
      valor: value.parametros[c.key].trim(), unidad: c.unidad ?? null,
    }])),
    productos: value.productos.map((p) => ({
      producto_id: p.producto_id, lote_id: p.lote_id || null, dosis: decimalPositivo(p.dosis),
      unidad_dosis: p.unidad_dosis, unidad_cantidad: p.unidad_cantidad,
      ...(p.densidad ? { densidad_kg_l: decimalPositivo(p.densidad) } : {}),
    })),
  }, plantilla);
}

export function errorPlanificacion(plantilla: PlantillaId, value: PlanificacionValue, contexto: ContextoPlanificacion, origen?: string, destino?: string): string | null {
  try { validarRelacionesPlan(construirPlanificacion(plantilla, value), contexto, origen, destino); return null; }
  catch (e) {
    if (e instanceof ZodError) return "Revisa los productos, lotes y valores previstos";
    return e instanceof Error ? e.message : "Revisa los datos previstos";
  }
}

export function PlanificacionFields({ plantilla, contexto, origen, destino, onOrigenChange, onDestinoChange, value, onChange }: {
  plantilla: PlantillaId; contexto: ContextoPlanificacion; origen: string; destino: string;
  onOrigenChange: (v: string) => void; onDestinoChange: (v: string) => void;
  value: PlanificacionValue; onChange: (v: PlanificacionValue) => void;
}) {
  const p = PLANTILLAS_TRABAJO[plantilla];
  const dep = contexto.depositos.find((d) => d.codigo === (plantilla === "trasiego" ? origen : destino));
  const target = contexto.depositos.find((d) => d.codigo === destino);
  const analiticas = dep ? contexto.analiticas.filter((a) => a.deposito_id === dep.id) : [];
  const lotesRelacionados = Array.from(new Set(analiticas.map((a) => a.lote_id))).map((id) => contexto.lotes.find((l) => l.id === id)).filter((l) => l !== undefined);
  const updateProducto = (id: string, patch: Partial<ProductoDosisValue>) => onChange({ ...value, productos: value.productos.map((r) => r.id === id ? { ...r, ...patch } : r) });
  const selectDeposito = (label: string, selected: string, change: (v: string) => void) => <div className="space-y-1">
    <Label>{label} *</Label><Select value={selected || "__none"} onValueChange={(v) => change(v === "__none" ? "" : v)}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="__none">Seleccionar depósito</SelectItem>{contexto.depositos.map((d) => <SelectItem key={d.id} value={d.codigo}>{d.codigo} · {d.litros.toLocaleString("es-ES")} L</SelectItem>)}</SelectContent>
    </Select>
  </div>;
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{p.nombre} · v{p.version}</span><span>Cantidades previstas</span></div>
    <div className="grid sm:grid-cols-2 gap-3">
      {plantilla === "trasiego" && selectDeposito("Depósito origen", origen, onOrigenChange)}
      {selectDeposito(plantilla === "trasiego" ? "Depósito destino" : "Depósito a tratar", destino, onDestinoChange)}
      <div className="space-y-1"><Label htmlFor="plan-litros">Litros previstos para {plantilla === "trasiego" ? "trasladar" : "tratar"} *</Label>
        <Input id="plan-litros" inputMode="decimal" value={value.litros} onChange={(e) => onChange({ ...value, litros: e.target.value })} />
      </div>
    </div>
    {dep && <dl className="grid sm:grid-cols-2 gap-2 bg-muted p-3 text-xs rounded-md">
      <div><dt className="text-muted-foreground">Existencias físicas</dt><dd>{dep.litros.toLocaleString("es-ES")} L</dd></div>
      <div><dt className="text-muted-foreground">Capacidad</dt><dd>{dep.capacidad.toLocaleString("es-ES")} L</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Producto actual</dt><dd>{dep.contenidos.length ? dep.contenidos.map((c) => `${c.nombre} · ${c.litros.toLocaleString("es-ES")} L${c.grado !== null ? ` · ${c.grado}°` : ""}`).join("; ") : "Vacío"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Lotes relacionados con analíticas</dt><dd>{lotesRelacionados.length ? lotesRelacionados.map((l) => l.numero_lote).join(", ") : "Sin lote vinculado en los datos disponibles"}</dd></div>
      {plantilla === "trasiego" && target && <div><dt className="text-muted-foreground">Capacidad disponible en destino</dt><dd>{Math.max(0, target.capacidad - target.litros).toLocaleString("es-ES")} L</dd></div>}
    </dl>}
    {analiticas.length > 0 && <details className="border-b pb-3 text-xs"><summary className="cursor-pointer">Analíticas disponibles ({analiticas.length})</summary><ul className="mt-2 space-y-1">{analiticas.map((a) => <li key={a.id}>{a.fecha} · {a.parametro}: {a.valor ?? a.valor_texto ?? "—"} {a.unidad}</li>)}</ul></details>}
    {plantilla !== "trasiego" && <section className="space-y-3">
      <div className="flex justify-between items-center"><Label>Productos enológicos previstos</Label><Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, productos: [...value.productos, { id: crypto.randomUUID(), producto_id: "", lote_id: "", dosis: "", unidad_dosis: "g/hL", unidad_cantidad: "kg", densidad: "" }] })}><Plus className="size-4 mr-1" />Añadir producto</Button></div>
      {value.productos.map((r, i) => {
        let cantidad: string = "—";
        try { cantidad = `${calcularDosificacion(decimalPositivo(value.litros), decimalPositivo(r.dosis), r.unidad_dosis, r.unidad_cantidad, r.densidad ? decimalPositivo(r.densidad) : undefined).toLocaleString("es-ES", { maximumSignificantDigits: 12 })} ${r.unidad_cantidad}`; } catch { /* incomplete input */ }
        return <div key={r.id} className="border-b border-border pb-3 space-y-2">
          <div className="flex justify-between items-center"><span className="text-xs font-medium">Producto {i + 1}</span><Button type="button" size="icon" variant="ghost" aria-label={`Retirar producto ${i + 1}`} title="Retirar producto" onClick={() => onChange({ ...value, productos: value.productos.filter((x) => x.id !== r.id) })}><Trash2 className="size-4" /></Button></div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div><Label>Producto *</Label><Select value={r.producto_id || "__none"} onValueChange={(v) => updateProducto(r.id, { producto_id: v === "__none" ? "" : v, lote_id: "" })}><SelectTrigger aria-label={`Producto ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Seleccionar producto</SelectItem>{contexto.productos.filter((x) => x.tipo === "enologico").map((x) => <SelectItem key={x.id} value={x.id}>{x.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Lote *</Label><Select value={r.lote_id || "__none"} onValueChange={(v) => updateProducto(r.id, { lote_id: v === "__none" ? "" : v })}><SelectTrigger aria-label={`Lote ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Seleccionar lote</SelectItem>{contexto.lotes.filter((l) => l.producto_id === r.producto_id).map((l) => <SelectItem key={l.id} value={l.id}>{l.numero_lote} · {l.estado}{l.fecha_caducidad ? ` · ${l.fecha_caducidad}` : ""}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor={`dosis-${r.id}`}>Dosis *</Label><Input id={`dosis-${r.id}`} aria-label={`Dosis ${i + 1}`} inputMode="decimal" value={r.dosis} onChange={(e) => updateProducto(r.id, { dosis: e.target.value })} /></div>
            <div><Label>Unidad de dosis</Label><Select value={r.unidad_dosis} onValueChange={(v) => updateProducto(r.id, { unidad_dosis: v as UnidadDosis })}><SelectTrigger aria-label={`Unidad de dosis ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{UNIDADES_DOSIS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Unidad de cantidad</Label><Select value={r.unidad_cantidad} onValueChange={(v) => updateProducto(r.id, { unidad_cantidad: v as UnidadCantidad })}><SelectTrigger aria-label={`Unidad de cantidad ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{UNIDADES_CANTIDAD.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor={`densidad-${r.id}`}>Densidad conocida (kg/L)</Label><Input id={`densidad-${r.id}`} inputMode="decimal" value={r.densidad} onChange={(e) => updateProducto(r.id, { densidad: e.target.value })} /></div>
          </div>
          <div className="text-sm font-medium" aria-live="polite">Cantidad prevista: {cantidad}</div>
        </div>;
      })}
    </section>}
    <div className="grid sm:grid-cols-2 gap-3">{p.campos.map((c) => <div key={c.key} className={c.multiline ? "sm:col-span-2" : ""}>
      <Label htmlFor={`param-${c.key}`}>{c.label}{c.unidad ? ` (${c.unidad})` : ""}</Label>
      {c.multiline ? <Textarea id={`param-${c.key}`} value={value.parametros[c.key] ?? ""} onChange={(e) => onChange({ ...value, parametros: { ...value.parametros, [c.key]: e.target.value } })} maxLength={2000} /> : <Input id={`param-${c.key}`} inputMode={c.unidad ? "decimal" : "text"} value={value.parametros[c.key] ?? ""} onChange={(e) => onChange({ ...value, parametros: { ...value.parametros, [c.key]: e.target.value } })} />}
    </div>)}</div>
  </div>;
}