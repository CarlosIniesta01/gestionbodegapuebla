import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UnidadEnum = z.enum(["g", "kg", "ml", "L", "sobres", "otro"]);

const DepSchema = z.object({
  zona_id: z.string().max(120).nullish(),
  deposito_codigo: z.string().trim().min(1).max(60),
  litros: z.number().nonnegative().nullish(),
  variedad: z.string().max(120).nullish(),
  observaciones: z.string().max(500).nullish(),
});

const ProdSchema = z.object({
  producto_id: z.string().uuid(),
  dosis: z.number().nonnegative().nullish(),
  unidad: UnidadEnum.default("g"),
  lote: z.string().trim().min(1, "Debes indicar el lote del producto para continuar.").max(120),
  observaciones: z.string().max(500).nullish(),
});

const PasoSchema = z.object({
  texto: z.string().trim().min(1).max(1000),
});

const RecetaInput = z.object({
  id: z.string().uuid().optional(),
  bodegaId: z.string().uuid(),
  nombre: z.string().trim().min(1).max(160),
  familia_id: z.string().uuid().nullish(),
  tipo: z.string().max(60).nullish(),
  descripcion: z.string().max(2000).nullish(),
  observaciones: z.string().max(2000).nullish(),
  activa: z.boolean().default(true),
  favorita: z.boolean().default(false),
  depositos: z.array(DepSchema).default([]),
  productos: z.array(ProdSchema).default([]),
  pasos: z.array(PasoSchema).default([]),
  // Versionado
  comoNuevaVersion: z.boolean().optional(),
});

// ---------- FAMILIAS ----------
export const listFamilias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("familias_recetas").select("*").eq("bodega_id", data.bodegaId).order("nombre");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertFamilia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid().optional(),
    bodegaId: z.string().uuid(),
    nombre: z.string().trim().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6b7280"),
  }))
  .handler(async ({ data, context }) => {
    const payload = { bodega_id: data.bodegaId, nombre: data.nombre, color: data.color };
    if (data.id) {
      const { error } = await context.supabase.from("familias_recetas").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("familias_recetas").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteFamilia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("familias_recetas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- RECETAS ----------
export const listRecetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("recetas")
      .select(`
        *,
        familia:familias_recetas(id,nombre,color),
        receta_depositos(id,deposito_codigo,zona_id,litros),
        receta_productos(id,producto_id,dosis,unidad,lote,productos(id,nombre,tipo))
      `)
      .eq("bodega_id", data.bodegaId)
      .order("favorita", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getReceta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: r, error } = await supabase
      .from("recetas")
      .select(`
        *,
        familia:familias_recetas(id,nombre,color),
        receta_depositos(*),
        receta_productos(*, productos(id,nombre,tipo,lote)),
        receta_pasos(*)
      `)
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);

    // versiones (mismo parent o este como root)
    const rootId = r.parent_id ?? r.id;
    const { data: versiones } = await supabase
      .from("recetas")
      .select("id,nombre,version,created_at,created_by,activa")
      .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
      .order("version", { ascending: true });
    return { ...r, versiones: versiones ?? [] };
  });

async function writeChildren(supabase: any, recetaId: string, input: z.infer<typeof RecetaInput>) {
  // Validar lotes
  for (const p of input.productos) {
    if (!p.lote || !p.lote.trim()) {
      throw new Error("Debes indicar el lote del producto para continuar.");
    }
  }
  // Reset
  await supabase.from("receta_depositos").delete().eq("receta_id", recetaId);
  await supabase.from("receta_productos").delete().eq("receta_id", recetaId);
  await supabase.from("receta_pasos").delete().eq("receta_id", recetaId);

  if (input.depositos.length) {
    const rows = input.depositos.map((d, i) => ({
      receta_id: recetaId,
      zona_id: d.zona_id || null,
      deposito_codigo: d.deposito_codigo,
      litros: d.litros ?? null,
      variedad: d.variedad || null,
      observaciones: d.observaciones || null,
      orden: i,
    }));
    const { error } = await supabase.from("receta_depositos").insert(rows);
    if (error) throw new Error(error.message);
  }
  if (input.productos.length) {
    const rows = input.productos.map((p, i) => ({
      receta_id: recetaId,
      producto_id: p.producto_id,
      dosis: p.dosis ?? null,
      unidad: p.unidad,
      lote: p.lote.trim(),
      observaciones: p.observaciones || null,
      orden: i,
    }));
    const { error } = await supabase.from("receta_productos").insert(rows);
    if (error) throw new Error(error.message);
  }
  if (input.pasos.length) {
    const rows = input.pasos.map((p, i) => ({ receta_id: recetaId, texto: p.texto, orden: i }));
    const { error } = await supabase.from("receta_pasos").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export const upsertReceta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(RecetaInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const base = {
      bodega_id: data.bodegaId,
      nombre: data.nombre,
      familia_id: data.familia_id || null,
      tipo: data.tipo || null,
      descripcion: data.descripcion || null,
      observaciones: data.observaciones || null,
      activa: data.activa,
      favorita: data.favorita,
    };

    let recetaId = data.id;

    if (data.id && data.comoNuevaVersion) {
      // Crear como nueva versión enlazada al árbol existente
      const { data: orig } = await supabase.from("recetas")
        .select("id, parent_id, version").eq("id", data.id).single();
      const rootId = orig?.parent_id ?? orig?.id;
      const { data: siblings } = await supabase.from("recetas")
        .select("version").or(`id.eq.${rootId},parent_id.eq.${rootId}`);
      const nextVersion = Math.max(...(siblings ?? []).map((s: any) => s.version || 1), 1) + 1;
      const { data: row, error } = await supabase.from("recetas")
        .insert({ ...base, parent_id: rootId, version: nextVersion, created_by: userId })
        .select("id").single();
      if (error) throw new Error(error.message);
      recetaId = row.id;
    } else if (data.id) {
      const { error } = await supabase.from("recetas").update(base).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase.from("recetas")
        .insert({ ...base, created_by: userId }).select("id").single();
      if (error) throw new Error(error.message);
      recetaId = row.id;
    }

    await writeChildren(supabase, recetaId!, data);
    return { id: recetaId };
  });

export const duplicarReceta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), comoNuevaVersion: z.boolean().default(false) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error } = await supabase.from("recetas").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: deps } = await supabase.from("receta_depositos").select("*").eq("receta_id", data.id);
    const { data: prods } = await supabase.from("receta_productos").select("*").eq("receta_id", data.id);
    const { data: pasos } = await supabase.from("receta_pasos").select("*").eq("receta_id", data.id);

    let nombre = r.nombre;
    let parent_id: string | null = null;
    let version = 1;
    if (data.comoNuevaVersion) {
      parent_id = r.parent_id ?? r.id;
      const { data: siblings } = await supabase.from("recetas")
        .select("version").or(`id.eq.${parent_id},parent_id.eq.${parent_id}`);
      version = Math.max(...(siblings ?? []).map((s: any) => s.version || 1), 1) + 1;
    } else {
      nombre = `${r.nombre} (copia)`;
    }

    const { data: nuevo, error: e2 } = await supabase.from("recetas").insert({
      bodega_id: r.bodega_id, nombre, familia_id: r.familia_id, tipo: r.tipo,
      descripcion: r.descripcion, observaciones: r.observaciones,
      activa: true, favorita: false, parent_id, version, created_by: userId,
    }).select("id").single();
    if (e2) throw new Error(e2.message);

    if (deps?.length) {
      await supabase.from("receta_depositos").insert(deps.map((d: any) => ({
        receta_id: nuevo.id, zona_id: d.zona_id, deposito_codigo: d.deposito_codigo,
        litros: d.litros, variedad: d.variedad, observaciones: d.observaciones, orden: d.orden,
      })));
    }
    if (prods?.length) {
      await supabase.from("receta_productos").insert(prods.map((p: any) => ({
        receta_id: nuevo.id, producto_id: p.producto_id, dosis: p.dosis,
        unidad: p.unidad, lote: p.lote, observaciones: p.observaciones, orden: p.orden,
      })));
    }
    if (pasos?.length) {
      await supabase.from("receta_pasos").insert(pasos.map((p: any) => ({
        receta_id: nuevo.id, texto: p.texto, orden: p.orden,
      })));
    }
    return { id: nuevo.id };
  });

export const toggleFavorita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), favorita: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recetas").update({ favorita: data.favorita }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleActiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), activa: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recetas").update({ activa: data.activa }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReceta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recetas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarUso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.from("recetas").select("uso_count").eq("id", data.id).single();
    const next = (r?.uso_count ?? 0) + 1;
    const { error } = await context.supabase.from("recetas")
      .update({ uso_count: next, ultimo_uso_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
