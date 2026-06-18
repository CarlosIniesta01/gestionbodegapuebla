import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoEnum = z.enum(["enologico", "limpieza", "otro"]);

export const listProductos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    soloActivos: z.boolean().default(false),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("productos").select("*").eq("bodega_id", data.bodegaId).order("nombre");
    if (data.soloActivos) q = q.eq("activo", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid().optional(),
    bodegaId: z.string().uuid(),
    nombre: z.string().trim().min(1, "Nombre obligatorio").max(120),
    tipo: TipoEnum,
    categoria: z.enum(["levaduras","nutrientes","clarificantes","estabilizantes","enzimas","limpieza","laboratorio","aditivos","consumibles","otro"]).nullable().optional(),
    fabricante: z.string().max(120).nullable().optional(),
    referencia: z.string().max(80).nullable().optional(),
    unidad: z.string().max(20).optional(),
    stock_minimo: z.number().min(0).nullable().optional(),
    stock_critico: z.number().min(0).nullable().optional(),
    ficha_tecnica_url: z.string().url().nullable().optional().or(z.literal("")),
    ficha_seguridad_url: z.string().url().nullable().optional().or(z.literal("")),
    lote: z.string().trim().min(1).optional(),
    proveedor: z.string().max(120).optional(),
    fecha_caducidad: z.string().optional(),
    activo: z.boolean().default(true),
    observaciones: z.string().max(500).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      bodega_id: data.bodegaId,
      nombre: data.nombre,
      tipo: data.tipo,
      categoria: data.categoria ?? null,
      fabricante: data.fabricante ?? null,
      referencia: data.referencia ?? null,
      unidad: data.unidad ?? "kg",
      stock_minimo: data.stock_minimo ?? null,
      stock_critico: data.stock_critico ?? null,
      ficha_tecnica_url: data.ficha_tecnica_url || null,
      ficha_seguridad_url: data.ficha_seguridad_url || null,
      lote: data.lote ?? null,
      proveedor: data.proveedor || null,
      fecha_caducidad: data.fecha_caducidad || null,
      activo: data.activo,
      observaciones: data.observaciones || null,
    };
    if (data.id) {
      const { error } = await supabase.from("productos").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase
        .from("productos")
        .insert({ ...payload, created_by: userId })
        .select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
  });


export const toggleProductoActivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), activo: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("productos").update({ activo: data.activo }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("productos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBodegaMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("memberships")
      .select("user_id, roles(nombre, color), profiles!inner(user_id, nombre, email, avatar_url)")
      .eq("bodega_id", data.bodegaId)
      .eq("estado", "activo");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((m: any) => ({
      user_id: m.user_id,
      nombre: m.profiles?.nombre ?? m.profiles?.email ?? "—",
      email: m.profiles?.email,
      avatar_url: m.profiles?.avatar_url,
      rol_nombre: m.roles?.nombre,
      rol_color: m.roles?.color,
    }));
  });
