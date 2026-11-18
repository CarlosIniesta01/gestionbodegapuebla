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

