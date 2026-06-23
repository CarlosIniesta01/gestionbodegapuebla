import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MOTIVO = "REINICIO OPERATIVO INICIAL ERP";

async function adminBodegaIds(supabase: any, userId: string): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("bodega_id, bodegas(id, nombre), roles!inner(key)")
    .eq("user_id", userId)
    .eq("estado", "activo")
    .eq("roles.key", "admin");
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  (data ?? []).forEach((m: any) => {
    if (m.bodegas?.id) map.set(m.bodegas.id, m.bodegas.nombre);
  });
  return Array.from(map, ([id, nombre]) => ({ id, nombre }));
}

function esEnocianina(nombre: string | null | undefined): boolean {
  if (!nombre) return false;
  return /enocianin/i.test(nombre);
}

type Linea = {
  bodegaId: string;
  bodegaNombre: string;
  depositoId: string;
  productoId: string;
  productoNombre: string;
  litros: number;
  grado: number;
};

async function recolectar(supabase: any, userId: string) {
  const bodegas = await adminBodegaIds(supabase, userId);
  if (bodegas.length === 0) return { bodegas, lineas: [] as Linea[], excluidos: [] as Linea[] };

  const ids = bodegas.map((b) => b.id);
  const { data: existencias, error: eEx } = await supabase
    .from("existencias_actuales")
    .select("bodega_id, deposito_id, producto_id, litros, grado_medio")
    .in("bodega_id", ids);
  if (eEx) throw new Error(eEx.message);

  const productosNeeded = Array.from(
    new Set((existencias ?? []).map((r: any) => r.producto_id).filter(Boolean) as string[]),
  );
  let productosMap = new Map<string, string>();
  if (productosNeeded.length > 0) {
    const { data: prods, error: ePr } = await supabase
      .from("productos_comerciales")
      .select("id, nombre")
      .in("id", productosNeeded);
    if (ePr) throw new Error(ePr.message);
    productosMap = new Map((prods ?? []).map((p: any) => [p.id, p.nombre]));
  }
  const bodegasMap = new Map(bodegas.map((b) => [b.id, b.nombre]));

  const lineas: Linea[] = [];
  const excluidos: Linea[] = [];
  for (const r of existencias ?? []) {
    const litros = Number(r.litros ?? 0);
    if (!r.deposito_id || litros <= 0.01) continue;
    const productoNombre = r.producto_id ? productosMap.get(r.producto_id) ?? "—" : "Sin producto";
    const linea: Linea = {
      bodegaId: r.bodega_id,
      bodegaNombre: bodegasMap.get(r.bodega_id) ?? "—",
      depositoId: r.deposito_id,
      productoId: r.producto_id ?? "",
      productoNombre,
      litros: Math.round(litros * 100) / 100,
      grado: Number(r.grado_medio ?? 0),
    };
    if (esEnocianina(productoNombre)) excluidos.push(linea);
    else lineas.push(linea);
  }
  return { bodegas, lineas, excluidos };
}

export const previewReinicioOperativoGlobal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { bodegas, lineas, excluidos } = await recolectar(supabase, userId);
    const totalLitros = lineas.reduce((a, l) => a + l.litros, 0);
    return {
      bodegas,
      lineas,
      excluidos,
      resumen: {
        totalBodegasAfectadas: new Set(lineas.map((l) => l.bodegaId)).size,
        totalDepositosAfectados: lineas.length,
        totalLitrosAjustados: Math.round(totalLitros * 100) / 100,
        totalDepositosExcluidos: excluidos.length,
      },
    };
  });

export const ejecutarReinicioOperativoGlobal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { confirmacion: string }) =>
    z.object({ confirmacion: z.literal("REINICIAR") }).parse(d),
  )
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { lineas } = await recolectar(supabase, userId);
    if (lineas.length === 0) return { ok: true, ajustados: 0, errores: [] as string[] };

    const fecha = new Date().toISOString().slice(0, 10);
    const hora = new Date().toTimeString().slice(0, 8);

    const inserts = lineas.map((l) => ({
      bodega_id: l.bodegaId,
      tipo: "ajuste" as const,
      fecha,
      hora,
      deposito_origen_id: l.depositoId,
      producto_id: l.productoId || null,
      litros: l.litros,
      grado: l.grado || null,
      observaciones: MOTIVO,
      created_by: userId,
    }));

    const errores: string[] = [];
    let ajustados = 0;
    // insert in chunks of 100
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const { error } = await supabase.from("movimientos").insert(chunk);
      if (error) errores.push(error.message);
      else ajustados += chunk.length;
    }
    return { ok: errores.length === 0, ajustados, errores };
  });
