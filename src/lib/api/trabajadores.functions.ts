import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planAsignacion, requiereNuevoResponsable } from "@/lib/asignaciones";

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

// B1: asignación múltiple sin duplicados (un único trabajo, varias asignaciones).
export const asignarTrabajadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    trabajoId: z.string().uuid(),
    trabajadores: z.array(z.string().uuid()).min(1).max(50),
    responsableId: z.string().uuid().nullable().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bodegaId = await centroDelTrabajo(supabase, data.trabajoId, data.bodegaId);
    const { data: ex, error } = await supabase.from("trabajo_trabajadores")
      .select("id,trabajador_id,estado_participacion,activa,es_responsable").eq("trabajo_id", data.trabajoId);
    if (error) throw new Error(error.message);
    const plan = planAsignacion((ex ?? []) as any, data.trabajadores);
    for (const id of plan.reactivar) {
      const { error: e } = await supabase.from("trabajo_trabajadores").update({
        activa: true, estado_participacion: "asignado", motivo_rechazo: null, respondido_at: null,
        retirado_por: null, retirado_at: null, motivo_retiro: null,
      } as any).eq("id", id);
      if (e) throw new Error(e.message);
    }
    if (plan.insertar.length) {
      const { error: e } = await supabase.from("trabajo_trabajadores").insert(plan.insertar.map((uid) => ({
        bodega_id: bodegaId, trabajo_id: data.trabajoId, trabajador_id: uid,
        created_by: userId, estado_participacion: "asignado",
      })) as any);
      if (e) throw new Error(e.message);
    }
    if (data.responsableId) await fijarResponsable(supabase, data.trabajoId, data.responsableId);
    return plan;
  });

async function centroDelTrabajo(supabase: any, trabajoId: string, bodegaId: string) {
  // Siempre el centro guardado en el trabajo, nunca el activo de la sesión.
  const { data: t, error } = await supabase.from("trabajos").select("bodega_id").eq("id", trabajoId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) throw new Error("Trabajo no encontrado");
  if (t.bodega_id !== bodegaId) throw new Error("El trabajo pertenece a otro centro");
  const { data: ok } = await supabase.rpc("has_permission", { _bodega: t.bodega_id, _perm: "tareas.asignar" });
  if (!ok) throw new Error("Sin permiso para gestionar asignaciones en este centro");
  return t.bodega_id as string;
}

async function fijarResponsable(supabase: any, trabajoId: string, trabajadorId: string) {
  const { data: rows } = await supabase.from("trabajo_trabajadores").select("id,trabajador_id,activa,es_responsable").eq("trabajo_id", trabajoId);
  const target = (rows ?? []).find((r: any) => r.activa && r.trabajador_id === trabajadorId);
  if (!target) throw new Error("El responsable debe ser uno de los trabajadores asignados");
  for (const r of rows ?? []) {
    if (r.es_responsable && r.id !== target.id) {
      const { error } = await supabase.from("trabajo_trabajadores").update({ es_responsable: false, rol_en_trabajo: "colaborador" } as any).eq("id", r.id);
      if (error) throw new Error(error.message);
    }
  }
  if (!target.es_responsable) {
    const { error } = await supabase.from("trabajo_trabajadores").update({ es_responsable: true, rol_en_trabajo: "responsable" } as any).eq("id", target.id);
    if (error) throw new Error(error.message);
  }
}

export const cambiarResponsable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), trabajoId: z.string().uuid(), trabajadorId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await centroDelTrabajo(context.supabase, data.trabajoId, data.bodegaId);
    await fijarResponsable(context.supabase, data.trabajoId, data.trabajadorId);
    return { ok: true };
  });

/** Compatibilidad: asignación individual. */
export const asignarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), trabajoId: z.string().uuid(), trabajadorId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bodegaId = await centroDelTrabajo(supabase, data.trabajoId, data.bodegaId);
    const { data: ex } = await supabase.from("trabajo_trabajadores")
      .select("id,trabajador_id,estado_participacion,activa,es_responsable").eq("trabajo_id", data.trabajoId);
    const plan = planAsignacion((ex ?? []) as any, [data.trabajadorId]);
    if (plan.omitidos.length) throw new Error("Este operario ya está asignado al trabajo");
    if (plan.reactivar.length) {
      const { error } = await supabase.from("trabajo_trabajadores").update({ activa: true, estado_participacion: "asignado", motivo_rechazo: null, respondido_at: null, retirado_por: null, retirado_at: null, motivo_retiro: null } as any).eq("id", plan.reactivar[0]);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("trabajo_trabajadores").insert({
      bodega_id: bodegaId, trabajo_id: data.trabajoId, trabajador_id: data.trabajadorId, created_by: userId, estado_participacion: "asignado",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** El operario acepta o rechaza (con motivo) su propia asignación. */
export const responderAsignacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), aceptar: z.boolean(), motivo: z.string().trim().max(500).optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error } = await supabase.from("trabajo_trabajadores").select("id,trabajador_id,activa,estado_participacion").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!r || r.trabajador_id !== userId) throw new Error("Solo puedes responder a tus propias asignaciones");
    if (!r.activa || !["asignado", "aceptado"].includes(r.estado_participacion)) throw new Error("Esta asignación ya no admite respuesta");
    if (!data.aceptar && !data.motivo) throw new Error("Indica el motivo del rechazo");
    const { error: e } = await supabase.from("trabajo_trabajadores").update({
      estado_participacion: data.aceptar ? "aceptado" : "rechazado",
      motivo_rechazo: data.aceptar ? null : data.motivo,
      respondido_at: new Date().toISOString(),
    } as any).eq("id", data.id);
    if (e) throw new Error(e.message);
    return { ok: true };
  });

const EstadoSchema = z.enum(["asignado","aceptado","en_proceso","finalizado","ausente","rechazado"]);

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

/** Retira una asignación sin borrarla (queda en el historial). */
export const retirarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(), id: z.string().uuid(),
    motivo: z.string().trim().max(500).optional(),
    nuevoResponsableId: z.string().uuid().nullable().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase.from("trabajo_trabajadores").select("trabajo_id").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Asignación no encontrada");
    await centroDelTrabajo(supabase, r.trabajo_id, data.bodegaId);
    const { data: rows } = await supabase.from("trabajo_trabajadores")
      .select("id,trabajador_id,estado_participacion,activa,es_responsable").eq("trabajo_id", r.trabajo_id);
    if (requiereNuevoResponsable((rows ?? []) as any, data.id) && !data.nuevoResponsableId)
      throw new Error("Selecciona un nuevo responsable de ejecución antes de retirar al actual");
    const { error } = await supabase.from("trabajo_trabajadores").update({
      activa: false, es_responsable: false, estado_participacion: "retirado",
      retirado_por: userId, retirado_at: new Date().toISOString(), motivo_retiro: data.motivo ?? null,
    } as any).eq("id", data.id).eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    if (data.nuevoResponsableId) await fijarResponsable(supabase, r.trabajo_id, data.nuevoResponsableId);
    return { ok: true };
  });

/** Fecha, prioridad e instrucciones antes de la ejecución (auditado en servidor). */
export const actualizarProgramacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    trabajoId: z.string().uuid(),
    scheduledAt: z.string().datetime().nullable(),
    prioridad: z.enum(["baja", "normal", "alta", "urgente"]),
    instrucciones: z.string().max(4000).nullable(),
    motivo: z.string().max(500).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("actualizar_programacion_trabajo", {
      _trabajo: data.trabajoId, _scheduled_at: data.scheduledAt as any, _prioridad: data.prioridad,
      _instrucciones: data.instrucciones ?? "", _motivo: data.motivo ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function enriquecer(supabase: any, trabajos: any[]) {
  const ids = trabajos.map((t) => t.id);
  if (!ids.length) return [];
  const [{ data: asig }, { data: ops }, { data: fams }, { data: bods }] = await Promise.all([
    supabase.from("trabajo_trabajadores").select("*").in("trabajo_id", ids).order("created_at"),
    supabase.from("operaciones_catalogo").select("id,codigo,nombre,familia_id"),
    supabase.from("familias_operativas").select("id,codigo,nombre"),
    supabase.from("bodegas").select("id,nombre"),
  ]);
  const uids = Array.from(new Set((asig ?? []).map((a: any) => a.trabajador_id)));
  const { data: profs } = uids.length ? await supabase.from("profiles").select("user_id,nombre,email").in("user_id", uids) : { data: [] };
  const pById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
  const opById = Object.fromEntries((ops ?? []).map((o: any) => [o.id, o]));
  const famById = Object.fromEntries((fams ?? []).map((f: any) => [f.id, f]));
  const bById = Object.fromEntries((bods ?? []).map((b: any) => [b.id, b.nombre]));
  return trabajos.map((t) => {
    const op = t.operacion_catalogo_id ? opById[t.operacion_catalogo_id] : null;
    return {
      ...t,
      centro_nombre: bById[t.bodega_id] ?? null,
      operacion: op ? { codigo: op.codigo, nombre: op.nombre } : null,
      familia: op ? famById[op.familia_id] ?? null : null,
      asignaciones: (asig ?? []).filter((a: any) => a.trabajo_id === t.id)
        .map((a: any) => ({ ...a, nombre: pById[a.trabajador_id]?.nombre || pById[a.trabajador_id]?.email || "Operario" })),
    };
  });
}

/** «Mis trabajos»: asignaciones del usuario en cualquiera de sus centros. */
export const listMisTrabajos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mias, error } = await supabase.from("trabajo_trabajadores").select("*").eq("trabajador_id", userId).order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const tids = Array.from(new Set((mias ?? []).map((m: any) => m.trabajo_id)));
    if (!tids.length) return [];
    const { data: ts, error: te } = await supabase.from("trabajos").select("*").in("id", tids);
    if (te) throw new Error(te.message);
    const enr = await enriquecer(supabase, ts ?? []);
    const byId = Object.fromEntries(enr.map((t: any) => [t.id, t]));
    return (mias ?? []).filter((m: any) => byId[m.trabajo_id]).map((m: any) => ({ ...m, trabajo: byId[m.trabajo_id] }));
  });

/** Panel de distribución: trabajos de los centros indicados con sus asignaciones. */
export const listDistribucion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaIds: z.array(z.string().uuid()).min(1).max(20) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const permitidos: string[] = [];
    for (const b of data.bodegaIds) {
      const { data: ok } = await supabase.rpc("has_permission", { _bodega: b, _perm: "tareas.asignar" });
      if (ok) permitidos.push(b);
    }
    if (!permitidos.length) return { permitido: false, trabajos: [] };
    const { data: ts, error } = await supabase.from("trabajos").select("*").in("bodega_id", permitidos)
      .in("estado", ["pendiente", "en_curso"]).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(500);
    if (error) throw new Error(error.message);
    return { permitido: true, trabajos: await enriquecer(supabase, ts ?? []) };
  });

export const puedeAsignar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_permission", { _bodega: data.bodegaId, _perm: "tareas.asignar" });
    return !!ok;
  });

export const listNotificaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).from("notificaciones").select("*")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const marcarNotificacionesLeidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return { ok: true };
    const { error } = await (context.supabase as any).from("notificaciones").update({ leida: true }).in("id", data.ids).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
