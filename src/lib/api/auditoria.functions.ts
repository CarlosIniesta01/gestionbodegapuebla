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

async function assertAdmin(supabase: any, bodegaId: string) {
  const { data, error } = await supabase.rpc("is_bodega_admin", { _bodega: bodegaId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo administradores");
}

// ===== Auditoría: listar registros =====
export const listAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
    tabla: z.string().optional(),
    accion: z.string().optional(),
    limit: z.number().int().min(1).max(2000).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    let q = supabase
      .from("auditoria")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 500);
    if (data.desde) q = q.gte("created_at", data.desde);
    if (data.hasta) q = q.lte("created_at", data.hasta);
    if (data.tabla) q = q.eq("tabla", data.tabla);
    if (data.accion) q = q.eq("accion", data.accion);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ===== Perfiles de auditoría =====
const PerfilSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(400).nullable().optional(),
  campos_visibles: z.array(z.string().min(1).max(80)).default([]),
  filtros: z.record(z.string(), z.any()).default({}),
  es_predeterminado: z.boolean().optional(),
});

export const listPerfilesAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("perfiles_auditoria")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .order("es_predeterminado", { ascending: false })
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPerfilAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: PerfilSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, data.bodegaId);
    // Si se marca como predeterminado, desmarcar los demás
    if (data.data.es_predeterminado) {
      await supabase
        .from("perfiles_auditoria")
        .update({ es_predeterminado: false })
        .eq("bodega_id", data.bodegaId);
    }
    const payload: any = { ...data.data, bodega_id: data.bodegaId };
    const q = data.id
      ? supabase.from("perfiles_auditoria").update(payload).eq("id", data.id).select().single()
      : supabase.from("perfiles_auditoria").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePerfilAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, data.bodegaId);
    const { error } = await supabase
      .from("perfiles_auditoria")
      .delete()
      .eq("id", data.id)
      .eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicarPerfilAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, data.bodegaId);
    const { data: src, error: e1 } = await supabase
      .from("perfiles_auditoria").select("*").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);
    const { data: row, error } = await supabase
      .from("perfiles_auditoria")
      .insert({
        bodega_id: src.bodega_id,
        nombre: `${src.nombre} (copia)`,
        descripcion: src.descripcion,
        campos_visibles: src.campos_visibles,
        filtros: src.filtros,
        es_predeterminado: false,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });
