export const UNIDADES_DOSIS = ["g/hL", "kg/hL", "mL/hL", "L/hL", "g/L", "mg/L"] as const;
export const UNIDADES_CANTIDAD = ["g", "kg", "mL", "L"] as const;
export type UnidadDosis = typeof UNIDADES_DOSIS[number];
export type UnidadCantidad = typeof UNIDADES_CANTIDAD[number];

const DOSIS: Record<UnidadDosis, { dimension: "masa" | "volumen"; factor: number }> = {
  "g/hL": { dimension: "masa", factor: 0.01 },
  "kg/hL": { dimension: "masa", factor: 10 },
  "g/L": { dimension: "masa", factor: 1 },
  "mg/L": { dimension: "masa", factor: 0.001 },
  "mL/hL": { dimension: "volumen", factor: 0.01 },
  "L/hL": { dimension: "volumen", factor: 10 },
};
const CANTIDAD: Record<UnidadCantidad, { dimension: "masa" | "volumen"; factor: number }> = {
  g: { dimension: "masa", factor: 1 }, kg: { dimension: "masa", factor: 1000 },
  mL: { dimension: "volumen", factor: 1 }, L: { dimension: "volumen", factor: 1000 },
};

export function decimalPositivo(valor: string): number {
  if (!/^\d+(?:[.,]\d+)?$/.test(valor.trim())) throw new Error("Introduce un decimal válido, sin separadores de miles");
  const n = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new Error("El valor debe ser mayor que cero");
  return n;
}

/** Base: g para masa, mL para volumen. Densidad expresada explícitamente en kg/L. */
export function calcularDosificacion(litros: number, dosis: number, unidad: UnidadDosis, salida: UnidadCantidad, densidadKgL?: number): number {
  if (!Number.isFinite(litros) || litros <= 0 || !Number.isFinite(dosis) || dosis <= 0)
    throw new Error("Los litros previstos y la dosis deben ser mayores que cero");
  const desde = DOSIS[unidad]; const hasta = CANTIDAD[salida];
  if (!desde || !hasta) throw new Error("Unidad no admitida");
  let base = litros * dosis * desde.factor;
  if (desde.dimension !== hasta.dimension) {
    if (densidadKgL === undefined || !Number.isFinite(densidadKgL) || densidadKgL <= 0)
      throw new Error("Para convertir masa y volumen hace falta la densidad en kg/L");
    base = desde.dimension === "masa" ? base / densidadKgL : base * densidadKgL;
  }
  const total = base / hasta.factor;
  if (!Number.isFinite(total) || total <= 0) throw new Error("Cantidad fuera de rango");
  return total;
}