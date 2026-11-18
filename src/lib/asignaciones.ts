// Reglas puras de asignación (Bloque B1). Sin efectos sobre inventario.
export interface Asig {
  id: string; trabajador_id: string; estado_participacion: string;
  activa: boolean; es_responsable: boolean;
}

export const ASIG_ESTADO_LABEL: Record<string, string> = {
  asignado: "Asignado", aceptado: "Aceptado", rechazado: "Rechazado", ausente: "Ausente",
  retirado: "Retirado", en_proceso: "En proceso", finalizado: "Finalizado",
};

export const TRABAJO_ESTADO_LABEL: Record<string, string> = {
  pendiente: "Programado", en_curso: "En curso", completado: "Finalizado", cancelado: "Cancelado",
};

export type CategoriaDistribucion = "sin_asignar" | "con_rechazo" | "pendiente_aceptacion" | "incompleta" | "asignado";

/** Situación de distribución de un trabajo según sus asignaciones activas. */
export function categoriaDistribucion(rows: Asig[]): CategoriaDistribucion {
  const act = rows.filter((r) => r.activa);
  if (act.length === 0) return "sin_asignar";
  if (act.some((r) => r.estado_participacion === "rechazado")) return "con_rechazo";
  if (act.length > 1 && !act.some((r) => r.es_responsable)) return "incompleta";
  if (act.some((r) => r.estado_participacion === "asignado")) return "pendiente_aceptacion";
  return "asignado";
}

/** Tras retirar a alguien: ¿hay que elegir otro responsable? */
export function requiereNuevoResponsable(rows: Asig[], retiradoId: string): boolean {
  const ret = rows.find((r) => r.id === retiradoId);
  const restantes = rows.filter((r) => r.activa && r.id !== retiradoId);
  return !!ret?.es_responsable && restantes.length > 1;
}

/** Plan de asignación sin duplicados: reactivar retirados/rechazados, insertar nuevos, ignorar activos. */
export function planAsignacion(existentes: Asig[], trabajadores: string[]) {
  const insertar: string[] = []; const reactivar: string[] = []; const omitidos: string[] = [];
  for (const uid of Array.from(new Set(trabajadores))) {
    const act = existentes.find((r) => r.trabajador_id === uid && r.activa);
    if (act && act.estado_participacion !== "rechazado") { omitidos.push(uid); continue; }
    if (act) { reactivar.push(act.id); continue; }
    const hist = existentes.find((r) => r.trabajador_id === uid && !r.activa);
    if (hist) reactivar.push(hist.id); else insertar.push(uid);
  }
  return { insertar, reactivar, omitidos };
}

export type FiltroMis = "hoy" | "proximos" | "pendientes" | "aceptados" | "historial";

export function filtrarMisTrabajos<T extends { estado_participacion: string; activa: boolean; trabajo: { scheduled_at: string | null; estado: string } }>(
  items: T[], f: FiltroMis, now = new Date(),
): T[] {
  const dia = now.toISOString().slice(0, 10);
  const vivo = (i: T) => i.activa && i.trabajo.estado !== "cancelado" && i.trabajo.estado !== "completado" && i.estado_participacion !== "rechazado";
  switch (f) {
    case "hoy": return items.filter((i) => vivo(i) && i.trabajo.scheduled_at?.slice(0, 10) === dia);
    case "proximos": return items.filter((i) => vivo(i) && (!i.trabajo.scheduled_at || i.trabajo.scheduled_at.slice(0, 10) > dia));
    case "pendientes": return items.filter((i) => vivo(i) && i.estado_participacion === "asignado");
    case "aceptados": return items.filter((i) => vivo(i) && i.estado_participacion === "aceptado");
    case "historial": return items.filter((i) => !i.activa || i.estado_participacion === "rechazado" || i.trabajo.estado === "cancelado");
  }
}
