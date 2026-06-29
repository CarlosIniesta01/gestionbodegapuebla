import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoEnum = z.enum([
  "carga","descarga","trabajo","limpieza","trasiego","mezcla","embotellado",
  "expedicion","mantenimiento","incidencia","recordatorio","auditoria","analisis",
]);
const EstadoEnum = z.enum(["programado","en_proceso","completado","cancelado","retrasado"]);
const PrioridadEnum = z.enum(["baja","normal","alta","critica"]);

async function assertMember(supabase: any, bodegaId: string, userId: string) {
  const { data, error } = await supabase
    .from("memberships").select("id")
    .eq("user_id", userId).eq("bodega_id", bodegaId).eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not a member of this bodega");
}

const EventoInput = z.object({
  bodegaId: z.string().uuid(),
  tipo: TipoEnum,
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional().nullable(),
  zonaId: z.string().uuid().optional().nullable(),
  depositoOrigen: z.string().max(60).optional().nullable(),
  depositoDestino: z.string().max(60).optional().nullable(),
  productoId: z.string().uuid().optional().nullable(),
  contratoCompraId: z.string().uuid().optional().nullable(),
  contratoVentaId: z.string().uuid().optional().nullable(),
  trabajoId: z.string().uuid().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
  proveedorId: z.string().uuid().optional().nullable(),
  fechaInicio: z.string(), // ISO
  fechaFin: z.string(),
  estado: EstadoEnum.default("programado"),
  prioridad: PrioridadEnum.default("normal"),
  datos: z.record(z.string(), z.unknown()).default({}),
  observaciones: z.string().max(2000).optional().nullable(),
  trabajadores: z.array(z.string().uuid()).default([]),
});

async function detectConflicts(supabase: any, bodegaId: string, input: {
  fechaInicio: string; fechaFin: string;
  depositoOrigen?: string|null; depositoDestino?: string|null;
  trabajadores: string[];
  excludeId?: string;
}) {
  const conflictos: string[] = [];
  const { fechaInicio, fechaFin } = input;
  let q = (supabase as any).from("calendario_eventos")
    .select("id,titulo,deposito_origen,deposito_destino,fecha_inicio,fecha_fin")
    .eq("bodega_id", bodegaId)
    .neq("estado", "cancelado")
    .lt("fecha_inicio", fechaFin)
    .gt("fecha_fin", fechaInicio);
  if (input.excludeId) q = q.neq("id", input.excludeId);
  const { data: solap } = await q;
  const deps = [input.depositoOrigen, input.depositoDestino].filter(Boolean) as string[];
  if (deps.length && solap?.length) {
    for (const ev of solap) {
      const used = [ev.deposito_origen, ev.deposito_destino].filter(Boolean);
      const dup = deps.find((d) => used.includes(d));
      if (dup) conflictos.push(`Depósito ${dup} ya reservado en "${ev.titulo}"`);
    }
  }
  if (input.trabajadores.length && solap?.length) {
    const ids = solap.map((e: any) => e.id);
    const { data: asig } = await supabase
      .from("calendario_evento_trabajadores")
      .select("user_id,evento_id")
      .in("evento_id", ids)
      .in("user_id", input.trabajadores);
    if (asig?.length) {
      for (const a of asig) {
        const ev = solap.find((e: any) => e.id === a.evento_id);
        conflictos.push(`Trabajador asignado en "${ev?.titulo ?? a.evento_id}"`);
      }
    }
  }
  return conflictos;
}

export const listEventos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid().nullable().optional(),
    from: z.string(),
    to: z.string(),
    tipos: z.array(TipoEnum).optional(),
    estados: z.array(EstadoEnum).optional(),
    prioridad: PrioridadEnum.optional(),
    userId: z.string().uuid().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("calendario_eventos")
      .select("*, asignados:calendario_evento_trabajadores(user_id)")
      .gte("fecha_fin", data.from)
      .lte("fecha_inicio", data.to)
      .order("fecha_inicio", { ascending: true })
      .limit(500);
    if (data.bodegaId) {
      await assertMember(supabase, data.bodegaId, userId);
      q = q.eq("bodega_id", data.bodegaId);
    }
    if (data.tipos?.length) q = q.in("tipo", data.tipos);
    if (data.estados?.length) q = q.in("estado", data.estados);
    if (data.prioridad) q = q.eq("prioridad", data.prioridad);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let result = rows ?? [];
    if (data.userId) {
      result = result.filter((r: any) =>
        r.created_by === data.userId || (r.asignados ?? []).some((a: any) => a.user_id === data.userId)
      );
    }
    return result;
  });

export const getEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("calendario_eventos")
      .select("*, asignados:calendario_evento_trabajadores(user_id)")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Evento no encontrado");
    return row;
  });

export const createEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(EventoInput.extend({ ignoreConflicts: z.boolean().default(false) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.bodegaId, userId);
    if (data.fechaFin <= data.fechaInicio) throw new Error("La fecha de fin debe ser posterior al inicio");
    const conflictos = await detectConflicts(supabase, data.bodegaId, {
      fechaInicio: data.fechaInicio, fechaFin: data.fechaFin,
      depositoOrigen: data.depositoOrigen, depositoDestino: data.depositoDestino,
      trabajadores: data.trabajadores,
    });
    if (conflictos.length && !data.ignoreConflicts) {
      return { ok: false, conflictos } as const;
    }
    const payload = {
      bodega_id: data.bodegaId, tipo: data.tipo, titulo: data.titulo,
      descripcion: data.descripcion ?? null, zona_id: data.zonaId ?? null,
      deposito_origen: data.depositoOrigen ?? null, deposito_destino: data.depositoDestino ?? null,
      producto_id: data.productoId ?? null,
      contrato_compra_id: data.contratoCompraId ?? null, contrato_venta_id: data.contratoVentaId ?? null,
      trabajo_id: data.trabajoId ?? null,
      cliente_id: data.clienteId ?? null, proveedor_id: data.proveedorId ?? null,
      fecha_inicio: data.fechaInicio, fecha_fin: data.fechaFin,
      estado: data.estado, prioridad: data.prioridad,
      datos: data.datos, observaciones: data.observaciones ?? null,
      created_by: userId,
    };
    const { data: row, error } = await (supabase as any).from("calendario_eventos").insert(payload as any).select("*").single();
    if (error) throw new Error(error.message);
    if (data.trabajadores.length) {
      const inserts = data.trabajadores.map((uid) => ({
        evento_id: row.id, user_id: uid, bodega_id: data.bodegaId,
      }));
      const { error: e2 } = await (supabase as any).from("calendario_evento_trabajadores").insert(inserts as any);
      if (e2) throw new Error(e2.message);
    }
    return { ok: true, evento: row, conflictos } as const;
  });

export const updateEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(EventoInput.partial().extend({
    id: z.string().uuid(), bodegaId: z.string().uuid(), ignoreConflicts: z.boolean().default(false),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    const map: Record<string, string> = {
      tipo: "tipo", titulo: "titulo", descripcion: "descripcion",
      zonaId: "zona_id", depositoOrigen: "deposito_origen", depositoDestino: "deposito_destino",
      productoId: "producto_id", contratoCompraId: "contrato_compra_id",
      contratoVentaId: "contrato_venta_id", trabajoId: "trabajo_id",
      clienteId: "cliente_id", proveedorId: "proveedor_id",
      fechaInicio: "fecha_inicio", fechaFin: "fecha_fin",
      estado: "estado", prioridad: "prioridad", datos: "datos", observaciones: "observaciones",
    };
    for (const [k, col] of Object.entries(map)) {
      if ((data as any)[k] !== undefined) patch[col] = (data as any)[k];
    }
    if (data.fechaInicio && data.fechaFin && data.fechaFin <= data.fechaInicio) {
      throw new Error("La fecha de fin debe ser posterior al inicio");
    }
    const { error } = await (supabase as any).from("calendario_eventos").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.trabajadores) {
      await (supabase as any).from("calendario_evento_trabajadores").delete().eq("evento_id", data.id);
      if (data.trabajadores.length) {
        const inserts = data.trabajadores.map((uid) => ({
          evento_id: data.id, user_id: uid, bodega_id: data.bodegaId,
        }));
        await (supabase as any).from("calendario_evento_trabajadores").insert(inserts as any);
      }
    }
    return { ok: true };
  });

export const setEventoEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), estado: EstadoEnum }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendario_eventos").update({ estado: data.estado }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("calendario_eventos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eventosHoy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid().nullable().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    let q = (supabase as any).from("calendario_eventos")
      .select("id,titulo,tipo,estado,prioridad,fecha_inicio,fecha_fin,deposito_origen,deposito_destino,bodega_id")
      .gte("fecha_fin", start.toISOString())
      .lte("fecha_inicio", end.toISOString())
      .order("fecha_inicio", { ascending: true });
    if (data.bodegaId) q = q.eq("bodega_id", data.bodegaId);
    const { data: hoy, error } = await q;
    if (error) throw new Error(error.message);

    let qr = (supabase as any).from("calendario_eventos")
      .select("id,titulo,tipo,estado,fecha_inicio,bodega_id")
      .lt("fecha_inicio", new Date().toISOString())
      .in("estado", ["programado","en_proceso","retrasado"])
      .order("fecha_inicio", { ascending: false })
      .limit(10);
    if (data.bodegaId) qr = qr.eq("bodega_id", data.bodegaId);
    const { data: retrasados } = await qr;

    let qc = (supabase as any).from("calendario_eventos")
      .select("id,titulo,tipo,fecha_inicio,prioridad,bodega_id")
      .gt("fecha_inicio", new Date().toISOString())
      .in("prioridad", ["alta","critica"])
      .in("estado", ["programado","en_proceso"])
      .order("fecha_inicio", { ascending: true })
      .limit(5);
    if (data.bodegaId) qc = qc.eq("bodega_id", data.bodegaId);
    const { data: criticos } = await qc;

    return {
      hoy: hoy ?? [],
      cargasHoy: (hoy ?? []).filter((e: any) => e.tipo === "carga" || e.tipo === "descarga").length,
      retrasados: retrasados ?? [],
      criticos: criticos ?? [],
    };
  });

export const listAsignables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.bodegaId, userId);
    const { data: mems } = await supabase
      .from("memberships").select("user_id")
      .eq("bodega_id", data.bodegaId).eq("estado", "activo");
    const ids = (mems ?? []).map((m: any) => m.user_id);
    if (!ids.length) return [] as Array<{ user_id: string; nombre: string | null; email: string | null; avatar_url: string | null }>;
    const { data: profs } = await supabase
      .from("profiles").select("user_id,nombre,email,avatar_url").in("user_id", ids);
    return (profs ?? []) as Array<{ user_id: string; nombre: string | null; email: string | null; avatar_url: string | null }>;
  });
