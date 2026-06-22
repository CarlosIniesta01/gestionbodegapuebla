import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(supabase: any, userId: string, bodegaId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, roles!inner(key)")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sin acceso a la bodega");
  return (data as any).roles?.key as string;
}

export type DashboardData = {
  role: string;
  bodega: {
    litros_totales: number;
    capacidad_total: number;
    ocupacion_pct: number;
    alcohol_absoluto: number;
    depositos_ocupados: number;
    depositos_vacios: number;
    depositos_total: number;
    depositos_llenos: Array<{ id: string; codigo: string; pct: number; litros: number; capacidad: number }>;
    reparto_estado: Array<{ estado: string; n: number }>;
  };
  comercial: {
    compra_pendiente: number;
    venta_pendiente: number;
    disponible_total: number;
    productos_negativos: number;
    top_productos: Array<{ producto_id: string; nombre: string; disponible: number; existencia: number; compras: number; ventas: number }>;
  } | null;
  almacen: {
    bajo_minimo: number;
    en_critico: number;
    lotes_por_caducar: number;
    lotes_caducados: number;
    productos_alerta: Array<{ producto_id: string; nombre: string; stock: number; minimo: number | null; critico: number | null; nivel: "critico" | "bajo" }>;
    lotes_alerta: Array<{ id: string; numero_lote: string; producto: string; fecha_caducidad: string; dias: number; estado: string }>;
  };
  operaciones: {
    pendientes: number;
    en_proceso: number;
    finalizados_hoy: number;
    incidencias: number;
    atrasados: Array<{ id: string; titulo: string; scheduled_at: string | null; prioridad: string }>;
    por_estado: Array<{ estado: string; n: number }>;
  };
  alertas: {
    contratos_vencidos: number;
    contratos_por_vencer: number;
    depositos_llenos: number;
  };
};

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<DashboardData> => {
    const { supabase, userId } = context;
    const role = await assertMember(supabase, userId, data.bodegaId);
    const bodegaId = data.bodegaId;
    const isOperario = role === "operario" || role === "limpieza" || role === "embotellado";

    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [exQ, mapQ, posQ, prodQ, lotesQ, trabQ, contComprQ, contVentQ] = await Promise.all([
      (supabase as any).from("existencias_actuales").select("*").eq("bodega_id", bodegaId),
      (supabase as any).from("bodega_maps").select("data").eq("bodega_id", bodegaId).maybeSingle(),
      isOperario ? Promise.resolve({ data: [], error: null }) :
        (supabase as any).from("v_posicion_comercial").select("*").eq("bodega_id", bodegaId),
      (supabase as any).from("productos").select("id,nombre,stock_minimo,stock_critico,tipo,activo")
        .eq("bodega_id", bodegaId).eq("tipo", "enologico").eq("activo", true),
      (supabase as any).from("producto_lotes")
        .select("id,numero_lote,producto_id,fecha_caducidad,estado,cantidad_disponible")
        .eq("bodega_id", bodegaId),
      (supabase as any).from("trabajos")
        .select("id,titulo,estado,prioridad,tipo,scheduled_at,completed_at")
        .eq("bodega_id", bodegaId)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(500),
      isOperario ? Promise.resolve({ data: [], error: null }) :
        (supabase as any).from("contratos_compra")
          .select("id,fecha_limite,estado").eq("bodega_id", bodegaId)
          .in("estado", ["pendiente", "parcial"]),
      isOperario ? Promise.resolve({ data: [], error: null }) :
        (supabase as any).from("contratos_venta")
          .select("id,fecha_limite,estado").eq("bodega_id", bodegaId)
          .in("estado", ["pendiente", "parcial"]),
    ]);

    for (const r of [exQ, mapQ, posQ, prodQ, lotesQ, trabQ, contComprQ, contVentQ]) {
      if ((r as any).error) throw new Error((r as any).error.message);
    }

    // ---------- BODEGA ----------
    const mapDeps: Array<any> = (mapQ.data?.data?.depositos as any[]) ?? [];
    const depById = new Map<string, any>(mapDeps.map((d) => [d.id, d]));
    const litrosByDep = new Map<string, number>();
    let alcoholTotal = 0;
    let litrosTotal = 0;
    for (const e of (exQ.data ?? [])) {
      const l = Number(e.litros ?? 0);
      litrosByDep.set(e.deposito_id, (litrosByDep.get(e.deposito_id) ?? 0) + l);
      litrosTotal += l;
      alcoholTotal += Number(e.alcohol_absoluto ?? 0);
    }
    let capacidadTotal = 0;
    const depLlenos: any[] = [];
    let ocupados = 0;
    const repartoEstado = new Map<string, number>();
    for (const d of mapDeps) {
      const cap = Number(d.capacidad ?? 0);
      capacidadTotal += cap;
      const l = litrosByDep.get(d.id) ?? 0;
      if (l > 0) ocupados++;
      const pct = cap > 0 ? (l / cap) * 100 : 0;
      if (pct >= 90) {
        depLlenos.push({ id: d.id, codigo: d.codigo || d.nombre || d.id, pct: Math.round(pct), litros: l, capacidad: cap });
      }
      const est = d.estado || "vacio";
      repartoEstado.set(est, (repartoEstado.get(est) ?? 0) + 1);
    }
    const ocupacionPct = capacidadTotal > 0 ? Math.round((litrosTotal / capacidadTotal) * 100) : 0;

    // ---------- COMERCIAL ----------
    let comercial: DashboardData["comercial"] = null;
    if (!isOperario) {
      const rows = (posQ.data ?? []) as any[];
      let cp = 0, vp = 0, dt = 0, neg = 0;
      for (const r of rows) {
        cp += Number(r.compras_pendientes ?? 0);
        vp += Number(r.ventas_pendientes ?? 0);
        dt += Number(r.disponible_comercial ?? 0);
        if (Number(r.disponible_comercial ?? 0) < 0) neg++;
      }
      const top = [...rows]
        .sort((a, b) => Number(b.disponible_comercial ?? 0) - Number(a.disponible_comercial ?? 0))
        .slice(0, 6)
        .map((r) => ({
          producto_id: r.producto_id,
          nombre: r.producto_nombre ?? r.codigo ?? "—",
          disponible: Number(r.disponible_comercial ?? 0),
          existencia: Number(r.litros_existencia ?? 0),
          compras: Number(r.compras_pendientes ?? 0),
          ventas: Number(r.ventas_pendientes ?? 0),
        }));
      comercial = {
        compra_pendiente: cp,
        venta_pendiente: vp,
        disponible_total: dt,
        productos_negativos: neg,
        top_productos: top,
      };
    }

    // ---------- ALMACÉN ----------
    const productos = (prodQ.data ?? []) as any[];
    const lotes = (lotesQ.data ?? []) as any[];
    const stockByProd = new Map<string, number>();
    for (const lo of lotes) {
      if (lo.estado === "disponible") {
        stockByProd.set(lo.producto_id, (stockByProd.get(lo.producto_id) ?? 0) + Number(lo.cantidad_disponible ?? 0));
      }
    }
    let bajoMin = 0, enCritico = 0;
    const productosAlerta: any[] = [];
    const prodById = new Map<string, any>(productos.map((p) => [p.id, p]));
    for (const p of productos) {
      const stock = stockByProd.get(p.id) ?? 0;
      const min = p.stock_minimo == null ? null : Number(p.stock_minimo);
      const crit = p.stock_critico == null ? null : Number(p.stock_critico);
      let nivel: "critico" | "bajo" | null = null;
      if (crit != null && stock <= crit) { nivel = "critico"; enCritico++; }
      else if (min != null && stock <= min) { nivel = "bajo"; bajoMin++; }
      if (nivel) productosAlerta.push({ producto_id: p.id, nombre: p.nombre, stock, minimo: min, critico: crit, nivel });
    }
    let lotesPorCad = 0, lotesCad = 0;
    const lotesAlerta: any[] = [];
    for (const lo of lotes) {
      if (!lo.fecha_caducidad) continue;
      const fc = lo.fecha_caducidad as string;
      if (lo.estado === "caducado" || fc < today) {
        if (Number(lo.cantidad_disponible ?? 0) > 0) lotesCad++;
      } else if (fc <= in30 && lo.estado === "disponible") {
        lotesPorCad++;
        const dias = Math.ceil((new Date(fc).getTime() - Date.now()) / 86400000);
        lotesAlerta.push({
          id: lo.id, numero_lote: lo.numero_lote,
          producto: prodById.get(lo.producto_id)?.nombre ?? "—",
          fecha_caducidad: fc, dias, estado: lo.estado,
        });
      }
    }
    lotesAlerta.sort((a, b) => a.dias - b.dias);

    // ---------- OPERACIONES ----------
    const trabajos = (trabQ.data ?? []) as any[];
    let pend = 0, enProc = 0, finHoy = 0, incid = 0;
    const porEstado = new Map<string, number>();
    const atrasados: any[] = [];
    for (const t of trabajos) {
      porEstado.set(t.estado, (porEstado.get(t.estado) ?? 0) + 1);
      if (t.estado === "pendiente") pend++;
      if (t.estado === "en_curso") enProc++;
      if (t.estado === "completado" && t.completed_at && new Date(t.completed_at) >= todayStart) finHoy++;
      if (t.tipo === "incidencia" && t.estado !== "completado" && t.estado !== "cancelado") incid++;
      if (t.estado === "pendiente" && t.scheduled_at && t.scheduled_at < new Date().toISOString()) {
        atrasados.push({ id: t.id, titulo: t.titulo, scheduled_at: t.scheduled_at, prioridad: t.prioridad });
      }
    }

    // ---------- ALERTAS ----------
    const cc = (contComprQ.data ?? []) as any[];
    const cv = (contVentQ.data ?? []) as any[];
    let cVenc = 0, cPorVenc = 0;
    for (const c of [...cc, ...cv]) {
      if (!c.fecha_limite) continue;
      if (c.fecha_limite < today) cVenc++;
      else if (c.fecha_limite <= in30) cPorVenc++;
    }

    return {
      role,
      bodega: {
        litros_totales: Math.round(litrosTotal),
        capacidad_total: Math.round(capacidadTotal),
        ocupacion_pct: ocupacionPct,
        alcohol_absoluto: Math.round(alcoholTotal * 100) / 100,
        depositos_ocupados: ocupados,
        depositos_vacios: mapDeps.length - ocupados,
        depositos_total: mapDeps.length,
        depositos_llenos: depLlenos.sort((a, b) => b.pct - a.pct).slice(0, 8),
        reparto_estado: Array.from(repartoEstado.entries()).map(([estado, n]) => ({ estado, n })),
      },
      comercial,
      almacen: {
        bajo_minimo: bajoMin,
        en_critico: enCritico,
        lotes_por_caducar: lotesPorCad,
        lotes_caducados: lotesCad,
        productos_alerta: productosAlerta.sort((a, b) => (a.nivel === "critico" ? -1 : 1)).slice(0, 10),
        lotes_alerta: lotesAlerta.slice(0, 10),
      },
      operaciones: {
        pendientes: pend,
        en_proceso: enProc,
        finalizados_hoy: finHoy,
        incidencias: incid,
        atrasados: atrasados.slice(0, 8),
        por_estado: Array.from(porEstado.entries()).map(([estado, n]) => ({ estado, n })),
      },
      alertas: {
        contratos_vencidos: cVenc,
        contratos_por_vencer: cPorVenc,
        depositos_llenos: depLlenos.length,
      },
    };
  });
