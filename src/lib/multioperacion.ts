import { z } from "zod";
import { plantillaParaOperacion, validarPlanificacion, type ContextoPlanificacion, type PlanificacionInput, type PlanificacionGuardada } from "./plantillas-trabajo";

export const MultioperacionSchema = z.object({
  version: z.literal(1),
  operaciones: z.array(z.object({ operacion_id: z.string().uuid(), planificacion: z.unknown() }).strict()).min(1).max(197),
  productos: z.array(z.object({ id: z.string().uuid(), operacion_id: z.string().uuid(), producto_id: z.string().uuid(), cantidad_prevista: z.number().finite().positive(), unidad: z.enum(["kg", "L"]) }).strict()).max(300),
}).strict();
export type MultioperacionInput = z.infer<typeof MultioperacionSchema>;
export type MultioperacionGuardada = { version: 1; operaciones: { operacion_id: string; codigo: string; nombre: string; planificacion: PlanificacionGuardada }[]; productos: (MultioperacionInput["productos"][number] & { nombre: string; proveedor: string | null })[] };

export function compatibles(principal: { codigo: string; tipo_formulario: string }, candidata: { codigo: string; tipo_formulario: string }) {
  const a = plantillaParaOperacion(principal), b = plantillaParaOperacion(candidata);
  return a !== null && b !== null && ((a === "trasiego" && b === "trasiego") || (a !== "trasiego" && b !== "trasiego"));
}

export function validarMultioperacion(input: unknown, principal: { id: string; codigo: string; tipo_formulario: string }, operaciones: { id: string; codigo: string; tipo_formulario: string }[], contexto: ContextoPlanificacion) {
  const multi = MultioperacionSchema.parse(input);
  if (multi.operaciones[0]?.operacion_id !== principal.id) throw new Error("La primera operación debe ser el trabajo principal");
  if (new Set(multi.operaciones.map((o) => o.operacion_id)).size !== multi.operaciones.length) throw new Error("No repitas operaciones en la orden");
  if (new Set(multi.productos.map((p) => p.id)).size !== multi.productos.length) throw new Error("Hay líneas de producto duplicadas");
  const planes: PlanificacionInput[] = multi.operaciones.map((linea) => {
    const op = operaciones.find((o) => o.id === linea.operacion_id);
    const plantilla = plantillaParaOperacion(op);
    if (!op || !plantilla || !compatibles(principal, op)) throw new Error("Operación relacionada no compatible con esta orden");
    const plan = validarPlanificacion(linea.planificacion, plantilla);
    if (plan.productos.length) throw new Error("Los productos deben figurar en la tabla única de la orden");
    return plan;
  });
  if (planes.some((p) => p.litros_previstos !== planes[0]?.litros_previstos)) throw new Error("Las operaciones deben compartir el volumen previsto de la orden");
  for (const p of multi.productos) {
    if (!multi.operaciones.some((o) => o.operacion_id === p.operacion_id)) throw new Error("El producto no está vinculado a una operación de la orden");
    if (!contexto.productos.some((r) => r.id === p.producto_id && r.tipo === "enologico")) throw new Error("Producto enológico ajeno al centro");
  }
  return { multi, planes };
}

export const UsoPreliminarSchema = z.object({
  trabajoId: z.string().uuid(), registroId: z.string().uuid(),
  usos: z.array(z.object({ linea_id: z.string().uuid(), lote_id: z.string().uuid(), cantidad_real: z.number().finite().positive(), fecha_caducidad: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict()).min(1).max(100),
}).strict();

export function cantidadEnUnidadLote(cantidad: number, unidad: "kg" | "L", unidadLote: string) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error("Cantidad real no válida");
  if (unidadLote === unidad) return cantidad;
  if ((unidad === "kg" && unidadLote === "g") || (unidad === "L" && unidadLote === "mL")) return cantidad * 1000;
  throw new Error("La unidad del lote no es compatible con la línea");
}

export function validarUsoLote(cantidad: number, unidad: "kg" | "L", lote: { unidad: string; estado: string; cantidad_disponible: number; fecha_caducidad: string | null }, fecha: string, hoy: string) {
  if (lote.estado !== "disponible") throw new Error("Lote bloqueado, agotado o caducado");
  if (!fecha || fecha < hoy || (lote.fecha_caducidad && fecha !== lote.fecha_caducidad)) throw new Error("Verifica la caducidad del lote");
  const total = cantidadEnUnidadLote(cantidad, unidad, lote.unidad);
  if (total > lote.cantidad_disponible) throw new Error("Cantidad real superior a la disponibilidad del lote");
  return total;
}