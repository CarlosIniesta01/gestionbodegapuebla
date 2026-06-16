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

const TIPOS = ["entrada","salida","trasiego","mezcla","embotellado","correccion","ajuste"] as const;

const MovimientoSchema = z.object({
  tipo: z.enum(TIPOS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  deposito_origen_id: z.string().max(80).nullable().optional(),
  deposito_destino_id: z.string().max(80).nullable().optional(),
  producto_id: z.string().uuid().nullable().optional(),
  litros: z.number().positive(),
  grado: z.number().min(0).max(25).nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
  trabajo_id: z.string().uuid().nullable().optional(),
});

export const listMovimientos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    limit: z.number().int().min(1).max(500).optional(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
    tipo: z.enum(TIPOS).optional(),
    deposito_id: z.string().optional(),
    producto_id: z.string().uuid().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    let q = supabase
      .from("movimientos")
      .select("*, productos_comerciales(id, nombre, codigo)")
      .eq("bodega_id", data.bodegaId)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.desde) q = q.gte("fecha", data.desde);
    if (data.hasta) q = q.lte("fecha", data.hasta);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.producto_id) q = q.eq("producto_id", data.producto_id);
    if (data.deposito_id) {
      q = q.or(`deposito_origen_id.eq.${data.deposito_id},deposito_destino_id.eq.${data.deposito_id}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createMovimiento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), data: MovimientoSchema }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);

    const d = data.data;
    // Validaciones por tipo
    if (d.tipo === "entrada" && !d.deposito_destino_id) {
      throw new Error("La entrada requiere depósito destino.");
    }
    if (d.tipo === "salida" && !d.deposito_origen_id) {
      throw new Error("La salida requiere depósito origen.");
    }
    if ((d.tipo === "trasiego" || d.tipo === "mezcla") &&
        (!d.deposito_origen_id || !d.deposito_destino_id)) {
      throw new Error("Trasiego/mezcla requieren origen y destino.");
    }

    const { data: row, error } = await supabase
      .from("movimientos")
      .insert({ ...d, bodega_id: data.bodegaId, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listExistencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("existencias_actuales")
      .select("*")
      .eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
