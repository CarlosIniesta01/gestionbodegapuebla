import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchHit = {
  kind:
    | "deposito"
    | "producto_comercial"
    | "producto_enologico"
    | "lote"
    | "contrato_compra"
    | "contrato_venta"
    | "cliente"
    | "proveedor"
    | "trabajo"
    | "centro";
  id: string;
  label: string;
  sub?: string;
  bodegaId?: string;
  href: string;
};

const PER = 5;

export const searchGlobal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      q: z.string().trim().min(1).max(80),
      bodegaId: z.string().uuid().optional().nullable(),
      global: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const { supabase } = context;
    const q = data.q;
    const like = `%${q.replace(/[%_]/g, " ")}%`;
    const scope = data.global ? null : data.bodegaId ?? null;

    const eqBodega = <T extends { eq: any }>(qb: T) =>
      scope ? (qb as any).eq("bodega_id", scope) : qb;

    const [
      mapsR,
      prodComR,
      prodEnoR,
      lotesR,
      ccR,
      cvR,
      cliR,
      provR,
      trabR,
      bodR,
    ] = await Promise.all([
      eqBodega((supabase as any).from("bodega_maps").select("bodega_id,data").limit(50)),
      eqBodega(
        (supabase as any)
          .from("productos_comerciales")
          .select("id,bodega_id,nombre,codigo,tipo")
          .or(`nombre.ilike.${like},codigo.ilike.${like}`)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("productos")
          .select("id,bodega_id,nombre,tipo")
          .eq("tipo", "enologico")
          .ilike("nombre", like)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("producto_lotes")
          .select("id,bodega_id,numero_lote,producto_id")
          .ilike("numero_lote", like)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("contratos_compra")
          .select("id,bodega_id,numero_contrato,estado,campana")
          .ilike("numero_contrato", like)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("contratos_venta")
          .select("id,bodega_id,numero_contrato,estado,campana")
          .ilike("numero_contrato", like)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("clientes")
          .select("id,bodega_id,nombre")
          .ilike("nombre", like)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("proveedores")
          .select("id,bodega_id,nombre")
          .ilike("nombre", like)
          .limit(PER),
      ),
      eqBodega(
        (supabase as any)
          .from("trabajos")
          .select("id,bodega_id,titulo,tipo,estado")
          .ilike("titulo", like)
          .limit(PER),
      ),
      (supabase as any)
        .from("bodegas")
        .select("id,nombre")
        .ilike("nombre", like)
        .limit(PER),
    ]);

    const hits: SearchHit[] = [];

    // Depósitos: filtrar JSON en memoria
    const ql = q.toLowerCase();
    const maps = (mapsR.data ?? []) as Array<{ bodega_id: string; data: any }>;
    for (const m of maps) {
      const deps = (m.data?.depositos ?? []) as any[];
      for (const d of deps) {
        const code = String(d.codigo ?? d.nombre ?? "");
        const cont = String(d.contenido ?? "");
        if (
          code.toLowerCase().includes(ql) ||
          cont.toLowerCase().includes(ql)
        ) {
          hits.push({
            kind: "deposito",
            id: d.id,
            label: code || "Depósito",
            sub: cont ? `${cont}` : undefined,
            bodegaId: m.bodega_id,
            href: `/bodega?dep=${encodeURIComponent(d.id)}`,
          });
          if (hits.filter((h) => h.kind === "deposito").length >= PER) break;
        }
      }
    }

    for (const r of (prodComR.data ?? []) as any[]) {
      hits.push({
        kind: "producto_comercial",
        id: r.id,
        label: r.nombre,
        sub: r.codigo ? `Cod. ${r.codigo}` : r.tipo,
        bodegaId: r.bodega_id,
        href: `/posicion-comercial?producto=${r.id}`,
      });
    }
    for (const r of (prodEnoR.data ?? []) as any[]) {
      hits.push({
        kind: "producto_enologico",
        id: r.id,
        label: r.nombre,
        sub: "Producto enológico",
        bodegaId: r.bodega_id,
        href: `/almacen?producto=${r.id}`,
      });
    }
    for (const r of (lotesR.data ?? []) as any[]) {
      hits.push({
        kind: "lote",
        id: r.id,
        label: `Lote ${r.numero_lote}`,
        bodegaId: r.bodega_id,
        href: `/almacen?lote=${r.id}`,
      });
    }
    for (const r of (ccR.data ?? []) as any[]) {
      hits.push({
        kind: "contrato_compra",
        id: r.id,
        label: `Compra ${r.numero_contrato}`,
        sub: `${r.estado}${r.campana ? " · " + r.campana : ""}`,
        bodegaId: r.bodega_id,
        href: `/contratos?id=${r.id}&tipo=compra`,
      });
    }
    for (const r of (cvR.data ?? []) as any[]) {
      hits.push({
        kind: "contrato_venta",
        id: r.id,
        label: `Venta ${r.numero_contrato}`,
        sub: `${r.estado}${r.campana ? " · " + r.campana : ""}`,
        bodegaId: r.bodega_id,
        href: `/contratos?id=${r.id}&tipo=venta`,
      });
    }
    for (const r of (cliR.data ?? []) as any[]) {
      hits.push({
        kind: "cliente",
        id: r.id,
        label: r.nombre,
        sub: "Cliente",
        bodegaId: r.bodega_id,
        href: `/contratos?cliente=${r.id}`,
      });
    }
    for (const r of (provR.data ?? []) as any[]) {
      hits.push({
        kind: "proveedor",
        id: r.id,
        label: r.nombre,
        sub: "Proveedor",
        bodegaId: r.bodega_id,
        href: `/contratos?proveedor=${r.id}`,
      });
    }
    for (const r of (trabR.data ?? []) as any[]) {
      hits.push({
        kind: "trabajo",
        id: r.id,
        label: r.titulo,
        sub: `${r.tipo} · ${r.estado}`,
        bodegaId: r.bodega_id,
        href: `/trabajos?id=${r.id}`,
      });
    }
    for (const r of (bodR.data ?? []) as any[]) {
      hits.push({
        kind: "centro",
        id: r.id,
        label: r.nombre,
        sub: "Centro",
        href: `/operativa?centro=${r.id}`,
      });
    }

    return hits.slice(0, 40);
  });
