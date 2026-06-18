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

async function assertCanRectify(supabase: any, bodegaId: string) {
  const { data, error } = await supabase.rpc("can_rectify_movimientos", { _bodega: bodegaId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo administradores o responsables pueden modificar movimientos.");
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

function validatePorTipo(d: z.infer<typeof MovimientoSchema>) {
  if (d.tipo === "entrada" && !d.deposito_destino_id) throw new Error("La entrada requiere depósito destino.");
  if (d.tipo === "salida" && !d.deposito_origen_id) throw new Error("La salida requiere depósito origen.");
  if ((d.tipo === "trasiego" || d.tipo === "mezcla") &&
      (!d.deposito_origen_id || !d.deposito_destino_id)) {
    throw new Error("Trasiego/mezcla requieren origen y destino.");
  }
}

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
    incluir_anulados: z.boolean().optional(),
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
    validatePorTipo(data.data);
    const { data: row, error } = await supabase
      .from("movimientos")
      .insert({ ...data.data, bodega_id: data.bodegaId, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Editar = marca el original como 'corregido' y crea uno nuevo enlazado por movimiento_original_id.
export const editMovimiento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid(),
    data: MovimientoSchema,
    motivo: z.string().trim().min(3, "Motivo obligatorio (mínimo 3 caracteres)").max(500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    await assertCanRectify(supabase, data.bodegaId);
    validatePorTipo(data.data);

    // Marcar original como corregido
    const { error: e1 } = await supabase
      .from("movimientos")
      .update({
        estado_movimiento: "corregido",
        motivo_correccion: data.motivo,
        corregido_por: userId,
        corregido_en: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("bodega_id", data.bodegaId);
    if (e1) throw new Error(e1.message);

    // Insertar nuevo movimiento referenciando al original
    const { data: row, error: e2 } = await supabase
      .from("movimientos")
      .insert({
        ...data.data,
        bodega_id: data.bodegaId,
        created_by: userId,
        movimiento_original_id: data.id,
        motivo_correccion: data.motivo,
      })
      .select()
      .single();
    if (e2) throw new Error(e2.message);
    return row;
  });

export const anularMovimiento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid(),
    motivo: z.string().trim().min(3, "Motivo obligatorio (mínimo 3 caracteres)").max(500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    await assertCanRectify(supabase, data.bodegaId);
    const { data: row, error } = await supabase
      .from("movimientos")
      .update({
        estado_movimiento: "anulado",
        motivo_anulacion: data.motivo,
        anulado_por: userId,
        anulado_en: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("bodega_id", data.bodegaId)
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

export const puedeRectificar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase
      .rpc("can_rectify_movimientos", { _bodega: data.bodegaId });
    if (error) throw new Error(error.message);
    return !!ok;
  });

export const listExistenciasPorProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("existencias_por_producto")
      .select("*")
      .eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
