import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(supabase: any, userId: string, bodegaId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sin acceso a la bodega");
}

const ProductoSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  nombre: z.string().trim().min(1).max(120),
  campaña: z.string().trim().max(20).nullable().optional(),
  tipo: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
  grado_referencia: z.number().min(0).max(25).nullable().optional(),
  activo: z.boolean().optional(),
});

export const listProductosComerciales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("productos_comerciales")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertProductoComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: ProductoSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const payload = {
      ...data.data,
      bodega_id: data.bodegaId,
      created_by: userId,
    };
    const q = data.id
      ? supabase.from("productos_comerciales").update(payload).eq("id", data.id).select().single()
      : supabase.from("productos_comerciales").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProductoComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { error } = await supabase
      .from("productos_comerciales")
      .delete()
      .eq("id", data.id)
      .eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
