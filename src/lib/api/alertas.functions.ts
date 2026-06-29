import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Alerta = {
  id: string;
  severity: "info" | "warn" | "danger";
  category:
    | "deposito"
    | "contrato"
    | "lote"
    | "stock"
    | "trabajo"
    | "comercial"
    | "producto";
  title: string;
  detail?: string;
  href?: string;
  bodegaId?: string;
};

export const getAlertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid().optional().nullable(),
      global: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ data, context }): Promise<Alerta[]> => {
    const { supabase } = context;
    const scope = data.global ? null : data.bodegaId ?? null;
    const eq = <T extends { eq: any }>(q: T) =>
      scope ? (q as any).eq("bodega_id", scope) : q;

    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

    const [exR, mapR, lotesR, prodR, ccR, cvR, trabR, posR, movR] = await Promise.all([
      eq((supabase as any).from("existencias_actuales").select("bodega_id,deposito_id,litros")),
      eq((supabase as any).from("bodega_maps").select("bodega_id,data")),
      eq(
        (supabase as any)
          .from("producto_lotes")
          .select("id,bodega_id,numero_lote,fecha_caducidad,estado,cantidad_disponible,producto_id"),
      ),
      eq(
        (supabase as any)
          .from("productos")
          .select("id,bodega_id,nombre,tipo,stock_minimo,stock_critico,activo")
          .eq("activo", true),
      ),
      eq(
        (supabase as any)
          .from("contratos_compra")
          .select("id,bodega_id,numero_contrato,fecha_limite,estado")
          .in("estado", ["pendiente", "parcial"]),
      ),
      eq(
        (supabase as any)
          .from("contratos_venta")
          .select("id,bodega_id,numero_contrato,fecha_limite,estado")
          .in("estado", ["pendiente", "parcial"]),
      ),
      eq(
        (supabase as any)
          .from("trabajos")
          .select("id,bodega_id,titulo,estado,scheduled_at,tipo")
          .in("estado", ["pendiente", "en_curso"]),
      ),
      eq((supabase as any).from("v_posicion_comercial").select("bodega_id,producto_id,producto_nombre,disponible_comercial")),
      eq(
        (supabase as any)
          .from("movimientos")
          .select("bodega_id,deposito_origen_id,deposito_destino_id,fecha")
          .eq("estado_movimiento", "activo")
          .gte("fecha", since90.slice(0, 10)),
      ),
    ]);

    const out: Alerta[] = [];

    // Stock by producto
    const stockByProd = new Map<string, number>();
    for (const lo of (lotesR.data ?? []) as any[]) {
      if (lo.estado === "disponible") {
        stockByProd.set(
          lo.producto_id,
          (stockByProd.get(lo.producto_id) ?? 0) + Number(lo.cantidad_disponible ?? 0),
        );
      }
    }
    for (const p of (prodR.data ?? []) as any[]) {
      if (p.tipo !== "enologico") continue;
      const s = stockByProd.get(p.id) ?? 0;
      const crit = p.stock_critico == null ? null : Number(p.stock_critico);
      const min = p.stock_minimo == null ? null : Number(p.stock_minimo);
      if (crit != null && s <= crit) {
        out.push({
          id: `stock-crit-${p.id}`,
          severity: "danger",
          category: "stock",
          title: `Stock crítico: ${p.nombre}`,
          detail: `${s} disp. · crítico ≤ ${crit}`,
          href: `/almacen?producto=${p.id}`,
          bodegaId: p.bodega_id,
        });
      } else if (min != null && s <= min) {
        out.push({
          id: `stock-bajo-${p.id}`,
          severity: "warn",
          category: "stock",
          title: `Stock bajo: ${p.nombre}`,
          detail: `${s} disp. · mínimo ≤ ${min}`,
          href: `/almacen?producto=${p.id}`,
          bodegaId: p.bodega_id,
        });
      }
    }

    // Lotes
    for (const lo of (lotesR.data ?? []) as any[]) {
      if (!lo.fecha_caducidad || Number(lo.cantidad_disponible ?? 0) <= 0) continue;
      if (lo.estado === "caducado" || lo.fecha_caducidad < today) {
        out.push({
          id: `lote-cad-${lo.id}`,
          severity: "danger",
          category: "lote",
          title: `Lote caducado: ${lo.numero_lote}`,
          detail: `Caducó ${lo.fecha_caducidad}`,
          href: `/almacen?lote=${lo.id}`,
          bodegaId: lo.bodega_id,
        });
      } else if (lo.fecha_caducidad <= in30) {
        const dias = Math.ceil(
          (new Date(lo.fecha_caducidad).getTime() - Date.now()) / 86400000,
        );
        out.push({
          id: `lote-prox-${lo.id}`,
          severity: "warn",
          category: "lote",
          title: `Lote por caducar: ${lo.numero_lote}`,
          detail: `${dias} día(s) restantes`,
          href: `/almacen?lote=${lo.id}`,
          bodegaId: lo.bodega_id,
        });
      }
    }

    // Contratos
    for (const c of [...((ccR.data ?? []) as any[]), ...((cvR.data ?? []) as any[])]) {
      const isVenta = (cvR.data ?? []).some((x: any) => x.id === c.id);
      if (!c.fecha_limite) continue;
      if (c.fecha_limite < today) {
        out.push({
          id: `cont-venc-${c.id}`,
          severity: "danger",
          category: "contrato",
          title: `Contrato vencido: ${c.numero_contrato}`,
          detail: `Límite ${c.fecha_limite}`,
          href: `/contratos?id=${c.id}&tipo=${isVenta ? "venta" : "compra"}`,
          bodegaId: c.bodega_id,
        });
      } else if (c.fecha_limite <= in30) {
        out.push({
          id: `cont-prox-${c.id}`,
          severity: "warn",
          category: "contrato",
          title: `Contrato próximo a vencer: ${c.numero_contrato}`,
          detail: `Vence ${c.fecha_limite}`,
          href: `/contratos?id=${c.id}&tipo=${isVenta ? "venta" : "compra"}`,
          bodegaId: c.bodega_id,
        });
      }
    }

    // Trabajos retrasados
    const nowIso = new Date().toISOString();
    for (const t of (trabR.data ?? []) as any[]) {
      if (t.scheduled_at && t.scheduled_at < nowIso && t.estado === "pendiente") {
        out.push({
          id: `trab-atr-${t.id}`,
          severity: "warn",
          category: "trabajo",
          title: `Trabajo retrasado: ${t.titulo}`,
          detail: `Programado ${new Date(t.scheduled_at).toLocaleDateString("es-ES")}`,
          href: `/trabajos?id=${t.id}`,
          bodegaId: t.bodega_id,
        });
      }
    }

    // Depósitos: ocupación y vacíos
    const litrosByDep = new Map<string, number>();
    for (const e of (exR.data ?? []) as any[]) {
      litrosByDep.set(e.deposito_id, (litrosByDep.get(e.deposito_id) ?? 0) + Number(e.litros ?? 0));
    }
    const movByDep = new Set<string>();
    for (const m of (movR.data ?? []) as any[]) {
      if (m.deposito_origen_id) movByDep.add(m.deposito_origen_id);
      if (m.deposito_destino_id) movByDep.add(m.deposito_destino_id);
    }
    for (const mp of (mapR.data ?? []) as any[]) {
      const deps = (mp.data?.depositos ?? []) as any[];
      for (const d of deps) {
        const cap = Number(d.capacidad ?? 0);
        const l = litrosByDep.get(d.id) ?? 0;
        const pct = cap > 0 ? (l / cap) * 100 : 0;
        if (pct >= 95) {
          out.push({
            id: `dep-lleno-${d.id}`,
            severity: "warn",
            category: "deposito",
            title: `Depósito al ${Math.round(pct)}%: ${d.codigo ?? d.id}`,
            detail: `${Math.round(l)} / ${cap} L`,
            href: `/bodega?dep=${d.id}`,
            bodegaId: mp.bodega_id,
          });
        }
        if (l <= 0 && cap > 0 && !movByDep.has(d.id)) {
          // Depósito sin movimiento 90d y vacío
          out.push({
            id: `dep-inactivo-${d.id}`,
            severity: "info",
            category: "deposito",
            title: `Depósito sin actividad: ${d.codigo ?? d.id}`,
            detail: `Vacío y sin movimientos en 90 días`,
            href: `/bodega?dep=${d.id}`,
            bodegaId: mp.bodega_id,
          });
        }
      }
    }

    // Comercial: disponible negativo
    for (const r of (posR.data ?? []) as any[]) {
      if (Number(r.disponible_comercial ?? 0) < 0) {
        out.push({
          id: `com-neg-${r.producto_id}-${r.bodega_id}`,
          severity: "danger",
          category: "comercial",
          title: `Disponible negativo: ${r.producto_nombre ?? "—"}`,
          detail: `${Math.round(Number(r.disponible_comercial))} L`,
          href: `/posicion-comercial?producto=${r.producto_id}`,
          bodegaId: r.bodega_id,
        });
      }
    }

    // Orden por severidad
    const rank = { danger: 0, warn: 1, info: 2 } as const;
    out.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return out.slice(0, 200);
  });
