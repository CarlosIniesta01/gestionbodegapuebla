import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validarCentro, validarOperacionCentro } from "./embotellado-validacion";

const TipoEnum = z.enum([
  "trasiego",
  "vendimia",
  "producto",
  "limpieza",
  "embotellado",
  "carga",
  "descarga",
  "incidencia",
  "observacion",
  "operacion",
]);
const EstadoEnum = z.enum(["pendiente", "en_curso", "completado", "cancelado"]);
const PrioridadEnum = z.enum(["baja", "normal", "alta", "urgente"]);

async function assertMember(supabase: any, bodegaId: string, userId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not a member of this bodega");
}

export const listTrabajos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    estado: z.array(EstadoEnum).optional(),
    tipo: TipoEnum.optional(),
    limit: z.number().min(1).max(200).default(100),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.bodegaId, userId);
    let q = supabase
      .from("trabajos")
      .select("*, autor:profiles!trabajos_created_by_fkey(user_id,nombre,avatar_url)")
      .eq("bodega_id", data.bodegaId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.estado?.length) q = q.in("estado", data.estado);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    const { data: rows, error } = await q;
    if (error) {
      // fallback without join if FK alias not present
      const { data: rows2, error: err2 } = await supabase
        .from("trabajos").select("*")
        .eq("bodega_id", data.bodegaId)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (err2) throw new Error(err2.message);
      return rows2 ?? [];
    }
    return rows ?? [];
  });

export const getTrabajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("trabajos").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Trabajo no encontrado");
    const { data: eventos, error: ee } = await supabase
      .from("trabajo_eventos")
      .select("*")
      .eq("trabajo_id", data.id)
      .order("created_at", { ascending: true });
    if (ee) throw new Error(ee.message);
    return { trabajo: row, eventos: eventos ?? [] };
  });

export const createTrabajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    tipo: TipoEnum,
    titulo: z.string().min(1).max(200),
    descripcion: z.string().max(2000).optional(),
    estado: EstadoEnum.default("pendiente"),
    prioridad: PrioridadEnum.default("normal"),
    deposito_origen: z.string().max(60).optional(),
    deposito_destino: z.string().max(60).optional(),
    asignado_a: z.string().uuid().optional(),
    scheduled_at: z.string().datetime().optional(),
    datos: z.record(z.string(), z.unknown()).default({}),
    operacion_catalogo_id: z.string().uuid().optional(),
    instrucciones: z.string().max(4000).optional(),
    asignacion: z.object({
      trabajadores: z.array(z.string().uuid()).max(50),
      responsableId: z.string().uuid().nullable().optional(),
    }).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.bodegaId, userId);
    const trabs = Array.from(new Set(data.asignacion?.trabajadores ?? []));
    if (trabs.length) {
      const { data: ok } = await supabase.rpc("has_permission", { _bodega: data.bodegaId, _perm: "tareas.asignar" });
      if (!ok) throw new Error("Sin permiso para asignar trabajos en este centro");
      if (trabs.length > 1 && !data.asignacion?.responsableId) throw new Error("Selecciona el responsable de ejecución");
      if (data.asignacion?.responsableId && !trabs.includes(data.asignacion.responsableId)) throw new Error("El responsable debe ser uno de los trabajadores asignados");
    }
    // Centro de destino: acceso, operación habilitada y depósitos del propio centro.
    await validarCentro(supabase, data.bodegaId, [data.deposito_origen, data.deposito_destino].filter(Boolean) as string[]);
    await validarOperacionCentro(supabase, data.bodegaId, data.operacion_catalogo_id);
    const payload = {
      operacion_catalogo_id: data.operacion_catalogo_id ?? null,
      bodega_id: data.bodegaId,
      tipo: data.tipo,
      titulo: data.titulo,
      descripcion: data.descripcion ?? null,
      estado: data.estado,
      prioridad: data.prioridad,
      deposito_origen: data.deposito_origen ?? null,
      deposito_destino: data.deposito_destino ?? null,
      asignado_a: data.asignado_a ?? null,
      scheduled_at: data.scheduled_at ?? null,
      datos: data.datos,
      instrucciones: data.instrucciones?.trim() || null,
      created_by: userId,
    };
    const { data: row, error } = await supabase
      .from("trabajos").insert(payload as any).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("trabajo_eventos").insert({
      trabajo_id: row.id,
      user_id: userId,
      tipo: "creado",
      contenido: `Trabajo creado (${data.tipo})`,
    });
    if (trabs.length) {
      const resp = trabs.length === 1 ? trabs[0] : data.asignacion!.responsableId!;
      const { error: ae } = await supabase.from("trabajo_trabajadores").insert(trabs.map((uid) => ({
        bodega_id: data.bodegaId, trabajo_id: row.id, trabajador_id: uid, created_by: userId,
        estado_participacion: "asignado", es_responsable: uid === resp, rol_en_trabajo: uid === resp ? "responsable" : "colaborador",
      })) as any);
      if (ae) throw new Error(`Trabajo creado, pero la asignación falló: ${ae.message}`);
    }
    return row;
  });

export const updateTrabajoEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    estado: EstadoEnum,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = { estado: data.estado };
    if (data.estado === "en_curso") patch.started_at = new Date().toISOString();
    if (data.estado === "completado") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("trabajos").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("trabajo_eventos").insert({
      trabajo_id: data.id,
      user_id: userId,
      tipo: "estado",
      contenido: `Estado → ${data.estado}`,
    });
    return { ok: true };
  });

export const addTrabajoComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    trabajoId: z.string().uuid(),
    contenido: z.string().min(1).max(2000),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("trabajo_eventos").insert({
      trabajo_id: data.trabajoId,
      user_id: userId,
      tipo: "comentario",
      contenido: data.contenido,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrabajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("trabajos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listActividad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    limit: z.number().min(1).max(200).default(80),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.bodegaId, userId);
    const { data: eventos, error } = await supabase
      .from("trabajo_eventos")
      .select("id, trabajo_id, user_id, tipo, contenido, created_at, trabajos!inner(bodega_id, titulo, tipo, estado, deposito_origen, deposito_destino)")
      .eq("trabajos.bodega_id", data.bodegaId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return eventos ?? [];
  });

export const deleteEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("trabajo_eventos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
