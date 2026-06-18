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

// Lista miembros activos de la bodega (cualquier miembro puede verlos para asignar).
export const listMiembrosBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("memberships")
      .select("user_id, estado, roles(key, nombre, color)")
      .eq("bodega_id", data.bodegaId)
      .eq("estado", "activo");
    if (error) throw new Error(error.message);
    const userIds = (rows ?? []).map((r: any) => r.user_id);
    if (!userIds.length) return [];
    const { data: profs, error: pe } = await supabase
      .from("profiles")
      .select("user_id, nombre, email, avatar_url")
      .in("user_id", userIds);
    if (pe) throw new Error(pe.message);
    const byId = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
    return (rows ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.roles,
      profile: byId[r.user_id] ?? null,
    }));
  });

export const listTrabajadoresTrabajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), trabajoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("trabajo_trabajadores")
      .select("*")
      .eq("trabajo_id", data.trabajoId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.trabajador_id)));
    let byId: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nombre, email, avatar_url")
        .in("user_id", userIds);
      byId = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, profile: byId[r.trabajador_id] ?? null }));
  });

export const asignarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    trabajoId: z.string().uuid(),
    trabajadorId: z.string().uuid(),
    rol: z.string().trim().max(80).optional(),
    movimientoId: z.string().uuid().nullable().optional(),
    procesoId: z.string().uuid().nullable().optional(),
    observaciones: z.string().max(500).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: row, error } = await supabase
      .from("trabajo_trabajadores")
      .insert({
        bodega_id: data.bodegaId,
        trabajo_id: data.trabajoId,
        trabajador_id: data.trabajadorId,
        rol_en_trabajo: data.rol ?? null,
        movimiento_id: data.movimientoId ?? null,
        proceso_id: data.procesoId ?? null,
        observaciones: data.observaciones ?? null,
        created_by: userId,
        estado_participacion: "asignado",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const EstadoSchema = z.enum(["asignado","en_proceso","finalizado","ausente","rechazado"]);

export const actualizarParticipacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid(),
    estado: EstadoSchema.optional(),
    hora_inicio: z.string().datetime().nullable().optional(),
    hora_fin: z.string().datetime().nullable().optional(),
    observaciones: z.string().max(500).nullable().optional(),
    rol_en_trabajo: z.string().max(80).nullable().optional(),
    confirmar: z.boolean().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const patch: Record<string, any> = {};
    if (data.estado !== undefined) {
      patch.estado_participacion = data.estado;
      if (data.estado === "en_proceso" && !data.hora_inicio) patch.hora_inicio = new Date().toISOString();
      if (data.estado === "finalizado" && !data.hora_fin) patch.hora_fin = new Date().toISOString();
    }
    if (data.hora_inicio !== undefined) patch.hora_inicio = data.hora_inicio;
    if (data.hora_fin !== undefined) patch.hora_fin = data.hora_fin;
    if (data.observaciones !== undefined) patch.observaciones = data.observaciones;
    if (data.rol_en_trabajo !== undefined) patch.rol_en_trabajo = data.rol_en_trabajo;
    if (data.confirmar) {
      patch.confirmado_por_trabajador = true;
      patch.fecha_confirmacion = new Date().toISOString();
    }
    const { data: row, error } = await supabase
      .from("trabajo_trabajadores")
      .update(patch as any)
      .eq("id", data.id)
      .eq("bodega_id", data.bodegaId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const retirarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { error } = await supabase
      .from("trabajo_trabajadores")
      .delete()
      .eq("id", data.id)
      .eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
