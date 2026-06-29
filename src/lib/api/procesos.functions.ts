import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Proceso = {
  id: string;
  source: "movimiento" | "trabajo";
  bucket: "recepcion" | "trasiego" | "mezcla" | "correccion" | "limpieza" | "embotellado" | "expedicion" | "otro";
  estado: string;
  origen?: string | null;
  destino?: string | null;
  producto?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  titulo: string;
  bodegaId: string;
  href: string;
};

function bucketFromTrabajo(tipo?: string | null): Proceso["bucket"] {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("limp")) return "limpieza";
  if (t.includes("embotell")) return "embotellado";
  if (t.includes("trasieg")) return "trasiego";
  if (t.includes("mezcl")) return "mezcla";
  if (t.includes("correc")) return "correccion";
  if (t.includes("recep")) return "recepcion";
  if (t.includes("expedi") || t.includes("salida")) return "expedicion";
  return "otro";
}

function bucketFromMov(tipo: string): Proceso["bucket"] {
  const t = tipo.toLowerCase();
  if (t === "entrada") return "recepcion";
  if (t === "salida") return "expedicion";
  if (t === "trasiego") return "trasiego";
  if (t.includes("mezcl")) return "mezcla";
  if (t.includes("correc")) return "correccion";
  return "otro";
}

export const listProcesos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid().optional().nullable(),
      global: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ data, context }): Promise<Proceso[]> => {
    const { supabase } = context;
    const scope = data.global ? null : data.bodegaId ?? null;
    const eq = <T extends { eq: any }>(q: T) =>
      scope ? (q as any).eq("bodega_id", scope) : q;

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [movR, trabR, mapR, prodR] = await Promise.all([
      eq(
        (supabase as any)
          .from("movimientos")
          .select("id,bodega_id,tipo,fecha,deposito_origen_id,deposito_destino_id,producto_id,estado_movimiento")
          .gte("fecha", since)
          .eq("estado_movimiento", "activo")
          .order("fecha", { ascending: false })
          .limit(200),
      ),
      eq(
        (supabase as any)
          .from("trabajos")
          .select("id,bodega_id,tipo,estado,titulo,scheduled_at,completed_at,deposito_origen,deposito_destino")
          .in("estado", ["pendiente", "en_curso"])
          .order("scheduled_at", { ascending: true, nullsFirst: false })
          .limit(200),
      ),
      eq((supabase as any).from("bodega_maps").select("bodega_id,data")),
      eq((supabase as any).from("productos").select("id,nombre")),
    ]);

    const depCode = new Map<string, string>();
    for (const m of (mapR.data ?? []) as any[]) {
      for (const d of (m.data?.depositos ?? []) as any[]) {
        depCode.set(d.id, d.codigo ?? d.nombre ?? d.id);
      }
    }
    const prodName = new Map<string, string>();
    for (const p of (prodR.data ?? []) as any[]) prodName.set(p.id, p.nombre);

    const out: Proceso[] = [];
    for (const m of (movR.data ?? []) as any[]) {
      out.push({
        id: `m-${m.id}`,
        source: "movimiento",
        bucket: bucketFromMov(m.tipo),
        estado: m.estado_movimiento,
        origen: m.deposito_origen_id ? depCode.get(m.deposito_origen_id) ?? null : null,
        destino: m.deposito_destino_id ? depCode.get(m.deposito_destino_id) ?? null : null,
        producto: m.producto_id ? prodName.get(m.producto_id) ?? null : null,
        fecha_inicio: m.fecha,
        fecha_fin: m.fecha,
        titulo: `${m.tipo}`,
        bodegaId: m.bodega_id,
        href: `/bodega`,
      });
    }
    for (const t of (trabR.data ?? []) as any[]) {
      out.push({
        id: `t-${t.id}`,
        source: "trabajo",
        bucket: bucketFromTrabajo(t.tipo),
        estado: t.estado,
        origen: t.deposito_origen ? depCode.get(t.deposito_origen) ?? t.deposito_origen : null,
        destino: t.deposito_destino ? depCode.get(t.deposito_destino) ?? t.deposito_destino : null,
        producto: null,
        fecha_inicio: t.scheduled_at,
        fecha_fin: t.completed_at,
        titulo: t.titulo,
        bodegaId: t.bodega_id,
        href: `/trabajos?id=${t.id}`,
      });
    }
    return out;
  });
