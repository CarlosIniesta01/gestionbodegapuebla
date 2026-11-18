/** Asignación inicial de operarios al crear un trabajo (única vía: trabajo_trabajadores, reglas B1). */
export interface AsignacionInicial { trabajadores: string[]; responsableId?: string | null }

export async function validarAsignacionInicial(supabase: any, bodegaId: string, a?: AsignacionInicial) {
  const trabs = Array.from(new Set(a?.trabajadores ?? []));
  if (!trabs.length) return trabs;
  const { data: ok } = await supabase.rpc("has_permission", { _bodega: bodegaId, _perm: "tareas.asignar" });
  if (!ok) throw new Error("Sin permiso para asignar trabajos en este centro");
  if (trabs.length > 1 && !a?.responsableId) throw new Error("Selecciona el responsable de ejecución");
  if (a?.responsableId && !trabs.includes(a.responsableId)) throw new Error("El responsable debe ser uno de los trabajadores asignados");
  return trabs;
}

export async function insertarAsignacionInicial(supabase: any, bodegaId: string, trabajoId: string, userId: string, trabs: string[], responsableId?: string | null) {
  if (!trabs.length) return;
  const resp = trabs.length === 1 ? trabs[0] : responsableId!;
  const { error } = await supabase.from("trabajo_trabajadores").insert(trabs.map((uid) => ({
    bodega_id: bodegaId, trabajo_id: trabajoId, trabajador_id: uid, created_by: userId,
    estado_participacion: "asignado", es_responsable: uid === resp, rol_en_trabajo: uid === resp ? "responsable" : "colaborador",
  })));
  if (error) throw new Error(`Trabajo creado, pero la asignación falló: ${error.message}`);
}
