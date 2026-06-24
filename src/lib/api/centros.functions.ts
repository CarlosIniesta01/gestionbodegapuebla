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

export type CentroResumen = {
  bodega_id: string;
  nombre: string;
  capacidad_total: number;
  litros_totales: number;
  ocupacion_pct: number;
  depositos_total: number;
  depositos_ocupados: number;
  depositos_vacios: number;
  depositos_llenos_90: number;
  trabajos_abiertos: number;
  trabajos_pendientes: number;
  trabajos_en_curso: number;
  trabajos_vencidos: number;
  trabajos_finalizados_hoy: number;
  incidencias_abiertas: number;
  movimientos_hoy: number;
  trasiegos_activos: number;
  contratos_pendientes: number;
  lotes_por_caducar: number;
  disponible_comercial: number;
};

async function buildResumen(supabase: any, bodegaId: string, nombre: string): Promise<CentroResumen> {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [exQ, mapQ, trabQ, movQ, contCQ, contVQ, lotesQ, posQ] = await Promise.all([
    supabase.from("existencias_actuales").select("deposito_id,litros").eq("bodega_id", bodegaId),
    supabase.from("bodega_maps").select("data").eq("bodega_id", bodegaId).maybeSingle(),
    supabase.from("trabajos").select("id,estado,tipo,scheduled_at,completed_at")
      .eq("bodega_id", bodegaId).limit(1000),
    supabase.from("movimientos").select("id,tipo,estado_movimiento,fecha,deposito_origen_id,deposito_destino_id")
      .eq("bodega_id", bodegaId).gte("fecha", todayStart.toISOString()),
    supabase.from("contratos_compra").select("id").eq("bodega_id", bodegaId).in("estado", ["pendiente", "parcial"]),
    supabase.from("contratos_venta").select("id").eq("bodega_id", bodegaId).in("estado", ["pendiente", "parcial"]),
    supabase.from("producto_lotes")
      .select("id,fecha_caducidad,estado,cantidad_disponible")
      .eq("bodega_id", bodegaId)
      .not("fecha_caducidad", "is", null)
      .lte("fecha_caducidad", in30)
      .gt("cantidad_disponible", 0),
    supabase.from("v_posicion_comercial").select("disponible").eq("bodega_id", bodegaId),
  ]);

  // Bodega map → capacidades
  const mapDeps: any[] = (mapQ.data?.data?.depositos as any[]) ?? [];
  const litrosByDep = new Map<string, number>();
  let litros_totales = 0;
  for (const e of (exQ.data ?? [])) {
    const l = Number(e.litros ?? 0);
    litrosByDep.set(e.deposito_id, (litrosByDep.get(e.deposito_id) ?? 0) + l);
    litros_totales += l;
  }
  let capacidad_total = 0;
  let depositos_ocupados = 0;
  let depositos_llenos_90 = 0;
  for (const d of mapDeps) {
    const cap = Number(d.capacidad ?? 0);
    capacidad_total += cap;
    const l = litrosByDep.get(d.id) ?? 0;
    if (l > 0.01) depositos_ocupados++;
    if (cap > 0 && l / cap >= 0.9) depositos_llenos_90++;
  }
  const depositos_total = mapDeps.length;
  const depositos_vacios = Math.max(0, depositos_total - depositos_ocupados);
  const ocupacion_pct = capacidad_total > 0 ? Math.round((litros_totales / capacidad_total) * 100) : 0;

  // Trabajos
  const trabajos = (trabQ.data ?? []) as any[];
  const trabajos_pendientes = trabajos.filter((t) => t.estado === "pendiente").length;
  const trabajos_en_curso = trabajos.filter((t) => t.estado === "en_proceso" || t.estado === "en_curso").length;
  const trabajos_abiertos = trabajos.filter((t) => !["finalizado", "completado", "cancelado", "anulado"].includes(t.estado)).length;
  const trabajos_vencidos = trabajos.filter((t) => t.scheduled_at && new Date(t.scheduled_at) < new Date() && !["finalizado", "completado", "cancelado"].includes(t.estado)).length;
  const trabajos_finalizados_hoy = trabajos.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === today).length;
  const incidencias_abiertas = trabajos.filter((t) => t.tipo === "incidencia" && !["finalizado", "completado", "cancelado"].includes(t.estado)).length;

  // Movimientos / trasiegos
  const movs = (movQ.data ?? []) as any[];
  const movimientos_hoy = movs.filter((m) => m.estado_movimiento === "activo").length;
  const trasiegos_activos = movs.filter((m) => m.tipo === "trasiego" && m.estado_movimiento === "activo").length;

  // Comercial
  const disponible_comercial = (posQ.data ?? []).reduce((s: number, r: any) => s + Number(r.disponible ?? 0), 0);

  return {
    bodega_id: bodegaId,
    nombre,
    capacidad_total, litros_totales, ocupacion_pct,
    depositos_total, depositos_ocupados, depositos_vacios, depositos_llenos_90,
    trabajos_abiertos, trabajos_pendientes, trabajos_en_curso, trabajos_vencidos, trabajos_finalizados_hoy,
    incidencias_abiertas,
    movimientos_hoy, trasiegos_activos,
    contratos_pendientes: (contCQ.data?.length ?? 0) + (contVQ.data?.length ?? 0),
    lotes_por_caducar: lotesQ.data?.length ?? 0,
    disponible_comercial,
  };
}

export const getCentroResumen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<CentroResumen> => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: bod } = await supabase.from("bodegas").select("id,nombre").eq("id", data.bodegaId).maybeSingle();
    return buildResumen(supabase, data.bodegaId, bod?.nombre ?? "Centro");
  });

export const getComparativaCentros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CentroResumen[]> => {
    const { supabase, userId } = context;
    const { data: mems, error } = await supabase
      .from("memberships")
      .select("bodega_id, bodegas!inner(id,nombre)")
      .eq("user_id", userId)
      .eq("estado", "activo");
    if (error) throw new Error(error.message);
    const list = (mems ?? []) as any[];
    const results = await Promise.all(
      list.map((m) => buildResumen(supabase, m.bodega_id, m.bodegas?.nombre ?? "Centro").catch(() => null)),
    );
    return results.filter(Boolean) as CentroResumen[];
  });

// Operativa diaria: lista detallada de items por centro
export type OperativaCentro = {
  trabajos: Array<{ id: string; titulo: string; estado: string; tipo: string; prioridad: string; scheduled_at: string | null; completed_at: string | null }>;
  movimientos_hoy: Array<{ id: string; tipo: string; litros: number; fecha: string; deposito_origen_id: string | null; deposito_destino_id: string | null }>;
  depositos_alta_ocupacion: Array<{ id: string; codigo: string; pct: number; litros: number; capacidad: number }>;
  trasiegos_activos: Array<{ id: string; origen: string | null; destino: string | null; litros: number; fecha: string }>;
  depositos_limpieza: Array<{ id: string; codigo: string }>;
};

export const getOperativaCentro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<OperativaCentro> => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [trabQ, movQ, mapQ, exQ] = await Promise.all([
      supabase.from("trabajos")
        .select("id,titulo,estado,tipo,prioridad,scheduled_at,completed_at")
        .eq("bodega_id", data.bodegaId)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(200),
      supabase.from("movimientos")
        .select("id,tipo,litros,fecha,deposito_origen_id,deposito_destino_id,estado_movimiento")
        .eq("bodega_id", data.bodegaId)
        .gte("fecha", todayStart.toISOString())
        .order("fecha", { ascending: false })
        .limit(100),
      supabase.from("bodega_maps").select("data").eq("bodega_id", data.bodegaId).maybeSingle(),
      supabase.from("existencias_actuales").select("deposito_id,litros").eq("bodega_id", data.bodegaId),
    ]);

    const mapDeps: any[] = ((mapQ.data?.data as any)?.depositos as any[]) ?? [];
    const litrosByDep = new Map<string, number>();
    for (const e of (exQ.data ?? [])) {
      litrosByDep.set(e.deposito_id, (litrosByDep.get(e.deposito_id) ?? 0) + Number(e.litros ?? 0));
    }
    const depositos_alta_ocupacion = mapDeps
      .map((d) => {
        const cap = Number(d.capacidad ?? 0);
        const l = litrosByDep.get(d.id) ?? 0;
        const pct = cap > 0 ? Math.round((l / cap) * 100) : 0;
        return { id: d.id, codigo: d.codigo ?? d.id, pct, litros: l, capacidad: cap };
      })
      .filter((d) => d.pct >= 90)
      .sort((a, b) => b.pct - a.pct);

    const depositos_limpieza = mapDeps
      .filter((d) => (d.estado ?? "").toLowerCase().includes("limpieza"))
      .map((d) => ({ id: d.id, codigo: d.codigo ?? d.id }));

    const movs = ((movQ.data ?? []) as any[]).filter((m) => m.estado_movimiento === "activo");
    const trasiegos_activos = movs
      .filter((m) => m.tipo === "trasiego")
      .map((m) => ({
        id: m.id, origen: m.deposito_origen_id, destino: m.deposito_destino_id,
        litros: Number(m.litros ?? 0), fecha: m.fecha,
      }));

    return {
      trabajos: (trabQ.data ?? []) as any[],
      movimientos_hoy: movs.map((m) => ({
        id: m.id, tipo: m.tipo, litros: Number(m.litros ?? 0), fecha: m.fecha,
        deposito_origen_id: m.deposito_origen_id, deposito_destino_id: m.deposito_destino_id,
      })),
      depositos_alta_ocupacion,
      trasiegos_activos,
      depositos_limpieza,
    };
  });
