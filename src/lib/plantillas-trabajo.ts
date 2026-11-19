import { z } from "zod";
import { calcularDosificacion, UNIDADES_CANTIDAD, UNIDADES_DOSIS } from "./dosificacion";

export type CampoTecnico = { key: string; label: string; unidad?: string; multiline?: boolean };
export const PLANTILLAS_TRABAJO = {
  trasiego: {
    nombre: "Trasiego", version: 1, campos: [
      { key: "instrucciones_trasiego", label: "Instrucciones de trasiego", multiline: true },
    ] as CampoTecnico[],
  },
  clarificacion: {
    nombre: "Clarificación", version: 1, campos: [
      { key: "preparacion", label: "Preparación", multiline: true },
      { key: "orden_incorporacion", label: "Orden de incorporación", multiline: true },
      { key: "tiempo_contacto", label: "Tiempo de contacto previsto", unidad: "h" },
    ] as CampoTecnico[],
  },
  fermentacion: {
    nombre: "Fermentación", version: 1, campos: [
      { key: "densidad", label: "Densidad", unidad: "kg/L" },
      { key: "temperatura", label: "Temperatura", unidad: "°C" },
      { key: "controles", label: "Controles solicitados", multiline: true },
    ] as CampoTecnico[],
  },
} as const;
export type PlantillaId = keyof typeof PLANTILLAS_TRABAJO;

/** Primera entrega de B2: asociación explícita por familia, sin alterar tipo_formulario. */
export function plantillaParaOperacion(op?: { codigo: string; tipo_formulario: string } | null): PlantillaId | null {
  if (!op || ["carga", "descarga", "embotellado", "traslado_intercentros"].includes(op.tipo_formulario) || op.codigo === "F06-08") return null;
  if (op.codigo.startsWith("F05-")) return "fermentacion";
  if (op.codigo.startsWith("F08-")) return "clarificacion";
  // Reparto, llenado, vaciado y homogeneización precisan otras topologías; no simular un trasiego.
  if (["F06-01", "F06-02", "F06-03", "F06-07"].includes(op.codigo)) return "trasiego";
  return null;
}

const ProductoPrevistoSchema = z.object({
  producto_id: z.string().uuid(), lote_id: z.string().uuid().nullable(),
  dosis: z.number().finite().positive(), unidad_dosis: z.enum(UNIDADES_DOSIS),
  unidad_cantidad: z.enum(UNIDADES_CANTIDAD), densidad_kg_l: z.number().finite().positive().optional(),
}).strict();
export const PlanificacionSchema = z.object({
  plantilla_id: z.enum(["trasiego", "clarificacion", "fermentacion"]),
  plantilla_version: z.literal(1), naturaleza: z.literal("prevision"),
  litros_previstos: z.number().finite().positive(),
  parametros: z.record(z.string(), z.object({ valor: z.string().trim().max(2000), unidad: z.string().max(30).nullable() }).strict()),
  productos: z.array(ProductoPrevistoSchema).max(30),
}).strict();
export type PlanificacionInput = z.infer<typeof PlanificacionSchema>;
export type PlanificacionGuardada = Omit<PlanificacionInput, "productos"> & {
  productos: (PlanificacionInput["productos"][number] & { cantidad_prevista: number; producto_nombre: string; lote_numero: string | null })[];
};

export function validarPlanificacion(input: unknown, plantillaId: PlantillaId): PlanificacionInput {
  const plan = PlanificacionSchema.parse(input);
  if (plan.plantilla_id !== plantillaId) throw new Error("La plantilla no corresponde a la operación seleccionada");
  const campos = PLANTILLAS_TRABAJO[plantillaId].campos;
  for (const [key, parametro] of Object.entries(plan.parametros)) {
    const campo = campos.find((c) => c.key === key);
    if (!campo || parametro.unidad !== (campo.unidad ?? null)) throw new Error("Parámetro o unidad no admitido por la plantilla");
    if (campo.unidad && parametro.valor && !Number.isFinite(Number(parametro.valor.replace(",", "."))))
      throw new Error(`Valor no válido: ${campo.label}`);
  }
  if (plantillaId === "trasiego" && plan.productos.length) throw new Error("El trasiego no admite dosificación en esta plantilla");
  for (const p of plan.productos) calcularDosificacion(plan.litros_previstos, p.dosis, p.unidad_dosis, p.unidad_cantidad, p.densidad_kg_l);
  return plan;
}

export type ContextoPlanificacion = {
  depositos: { id: string; codigo: string; capacidad: number; litros: number; contenidos: { producto_id: string; nombre: string; litros: number; grado: number | null }[] }[];
  productos: { id: string; nombre: string; tipo: string; unidad: string; proveedor?: string | null }[];
  lotes: { id: string; producto_id: string; numero_lote: string; estado: string; fecha_caducidad: string | null; unidad?: string; cantidad_disponible?: number }[];
  analiticas: { id: string; deposito_id: string | null; lote_id: string; parametro: string; valor: number | null; valor_texto: string | null; unidad: string | null; fecha: string }[];
};

/** Contexto obtenido exclusivamente del centro autorizado, con existencias oficiales. */
export function validarRelacionesPlan(plan: PlanificacionInput, contexto: ContextoPlanificacion, origen?: string, destino?: string) {
  const source = contexto.depositos.find((d) => d.codigo === origen);
  const target = contexto.depositos.find((d) => d.codigo === destino);
  if (plan.plantilla_id === "trasiego") {
    if (!source || !target) throw new Error("Selecciona origen y destino del centro");
    if (source.id === target.id) throw new Error("Origen y destino deben ser distintos");
    if (plan.litros_previstos > source.litros) throw new Error("Los litros previstos superan las existencias del origen");
    if (plan.litros_previstos > Math.max(0, target.capacidad - target.litros)) throw new Error("No hay capacidad disponible suficiente en el destino");
  } else {
    if (!target) throw new Error("Selecciona el depósito a tratar del centro");
    if (plan.litros_previstos > target.litros) throw new Error("Los litros previstos para tratar superan las existencias del depósito");
  }
  for (const p of plan.productos) {
    if (!contexto.productos.some((r) => r.id === p.producto_id && r.tipo === "enologico")) throw new Error("Producto enológico no disponible en este centro");
    if (!p.lote_id || !contexto.lotes.some((l) => l.id === p.lote_id && l.producto_id === p.producto_id)) throw new Error("Selecciona un lote del producto y del centro");
  }
}