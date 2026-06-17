// Catálogo de campos disponibles para perfiles de auditoría.
// La BD siempre guarda todo; los perfiles solo filtran qué se muestra/exporta.
export const CAMPOS_AUDITORIA = [
  { key: "created_at", label: "Fecha y hora" },
  { key: "user_id", label: "Usuario" },
  { key: "accion", label: "Acción" },
  { key: "tabla", label: "Tabla afectada" },
  { key: "registro_id", label: "Registro afectado" },
  { key: "payload.tipo", label: "Tipo de movimiento" },
  { key: "payload.deposito_origen_id", label: "Depósito origen" },
  { key: "payload.deposito_destino_id", label: "Depósito destino" },
  { key: "payload.producto_id", label: "Producto" },
  { key: "payload.litros", label: "Litros" },
  { key: "payload.grado", label: "Grado" },
  { key: "payload.alcohol_absoluto", label: "Alcohol absoluto" },
  { key: "payload.observaciones", label: "Observaciones" },
  { key: "payload.fecha", label: "Fecha del movimiento" },
  { key: "payload.hora", label: "Hora del movimiento" },
  { key: "payload.contrato_id", label: "Contrato" },
  { key: "payload.trabajo_id", label: "Trabajo relacionado" },
  { key: "payload.cliente", label: "Cliente" },
  { key: "payload.proveedor", label: "Proveedor" },
  { key: "payload.precio", label: "Precio" },
  { key: "payload.campaña", label: "Campaña" },
  { key: "payload.incidencias", label: "Incidencias" },
  { key: "payload", label: "Payload completo (JSON)" },
] as const;

export type CampoAuditoriaKey = (typeof CAMPOS_AUDITORIA)[number]["key"];

export function getCampoValue(row: any, key: string): any {
  if (!key.includes(".")) return row?.[key];
  const parts = key.split(".");
  let v: any = row;
  for (const p of parts) {
    if (v == null) return undefined;
    v = v[p];
  }
  return v;
}

export function formatCampo(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}
