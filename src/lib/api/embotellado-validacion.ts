// Validaciones de centro: acceso del usuario y depósitos/productos del mismo centro.
export async function validarCentro(supabase: any, bodegaId: string, depositos: string[], productoIds: string[] = []) {
  const { data: mis, error } = await supabase.rpc("current_user_bodegas");
  if (error) throw new Error(error.message);
  const ids = (mis ?? []).map((r: any) => (typeof r === "string" ? r : r.current_user_bodegas));
  if (!ids.includes(bodegaId)) throw new Error("No tienes acceso al centro seleccionado");
  const { data: map } = await supabase.from("bodega_maps").select("data").eq("bodega_id", bodegaId).maybeSingle();
  const codigos = new Set(((map?.data as any)?.depositos ?? []).map((d: any) => String(d.codigo)));
  for (const c of depositos) {
    if (!codigos.has(c)) throw new Error(`El depósito ${c} no pertenece al centro seleccionado`);
  }
  if (productoIds.length) {
    const { data: prods, error: e } = await supabase.from("productos").select("id,bodega_id").in("id", productoIds);
    if (e) throw new Error(e.message);
    for (const id of productoIds) {
      const p = (prods ?? []).find((x: any) => x.id === id);
      if (!p || p.bodega_id !== bodegaId) throw new Error("Hay productos que no pertenecen al centro seleccionado");
    }
  }
}


// La operación del catálogo debe estar activa y habilitada en el centro elegido.
export async function validarOperacionCentro(supabase: any, bodegaId: string, operacionId?: string | null) {
  if (!operacionId) return;
  const { data: op, error } = await supabase.from("operaciones_catalogo")
    .select("id,activo,bodega_id,familia_id").eq("id", operacionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!op || !op.activo || (op.bodega_id && op.bodega_id !== bodegaId)) throw new Error("La operación no está disponible en el centro seleccionado");
  const { data: fam } = await supabase.from("familias_operativas").select("activo").eq("id", op.familia_id).maybeSingle();
  if (!fam?.activo) throw new Error("La familia de la operación está inactiva");
  const { data: cfg } = await supabase.from("centro_operaciones").select("habilitada")
    .eq("bodega_id", bodegaId).eq("operacion_id", operacionId).maybeSingle();
  if (cfg && cfg.habilitada === false) throw new Error("La operación está deshabilitada en el centro seleccionado");
}
