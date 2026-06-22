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

export type PosicionRow = {
  bodega_id: string;
  producto_id: string;
  codigo: string | null;
  producto_nombre: string | null;
  campana: string | null;
  tipo: string | null;
  color: string | null;
  grado_referencia: number | null;
  litros_existencia: number;
  compras_pendientes: number;
  ventas_pendientes: number;
  disponible_comercial: number;
  alcohol_absoluto: number;
};

export const getPosicionComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<PosicionRow[]> => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any)
      .from("v_posicion_comercial")
      .select("*")
      .eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      litros_existencia: Number(r.litros_existencia ?? 0),
      compras_pendientes: Number(r.compras_pendientes ?? 0),
      ventas_pendientes: Number(r.ventas_pendientes ?? 0),
      disponible_comercial: Number(r.disponible_comercial ?? 0),
      alcohol_absoluto: Number(r.alcohol_absoluto ?? 0),
      grado_referencia: r.grado_referencia == null ? null : Number(r.grado_referencia),
    }));
  });

export const getPosicionDetalle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), productoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);

    const [exQ, compQ, vendQ, movQ, mapQ] = await Promise.all([
      (supabase as any).from("existencias_actuales").select("*")
        .eq("bodega_id", data.bodegaId).eq("producto_id", data.productoId),
      (supabase as any).from("contratos_compra").select("*, proveedores(nombre)")
        .eq("bodega_id", data.bodegaId).eq("producto_id", data.productoId)
        .order("fecha_contrato", { ascending: false }),
      (supabase as any).from("contratos_venta").select("*, clientes(nombre)")
        .eq("bodega_id", data.bodegaId).eq("producto_id", data.productoId)
        .order("fecha_contrato", { ascending: false }),
      (supabase as any).from("movimientos").select("*")
        .eq("bodega_id", data.bodegaId).eq("producto_id", data.productoId)
        .eq("estado_movimiento", "activo")
        .order("fecha", { ascending: false }).limit(100),
      (supabase as any).from("bodega_maps").select("data")
        .eq("bodega_id", data.bodegaId).maybeSingle(),
    ]);
    if (exQ.error) throw new Error(exQ.error.message);
    if (compQ.error) throw new Error(compQ.error.message);
    if (vendQ.error) throw new Error(vendQ.error.message);
    if (movQ.error) throw new Error(movQ.error.message);

    const depositos: Array<{ id: string; codigo?: string; nombre?: string }> =
      (mapQ.data?.data?.depositos as any[]) ?? [];
    const label = new Map<string, string>();
    for (const d of depositos) {
      label.set(d.id, d.codigo || d.nombre || d.id);
    }
    const lbl = (id: string | null | undefined) =>
      id ? (label.get(id) ?? id) : null;

    return {
      existencias: (exQ.data ?? []).map((e: any) => ({
        ...e, deposito_codigo: lbl(e.deposito_id),
      })),
      compras: compQ.data ?? [],
      ventas: vendQ.data ?? [],
      movimientos: (movQ.data ?? []).map((m: any) => ({
        ...m,
        deposito_origen_codigo: lbl(m.deposito_origen_id),
        deposito_destino_codigo: lbl(m.deposito_destino_id),
      })),
    };
  });

