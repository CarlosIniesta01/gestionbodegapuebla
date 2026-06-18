import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMember(supabase: any, userId: string, bodegaId: string) {
  const { data, error } = await supabase
    .from("memberships").select("id")
    .eq("user_id", userId).eq("bodega_id", bodegaId).eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sin acceso a la bodega");
}

async function assertCanRectify(supabase: any, bodegaId: string) {
  const { data, error } = await supabase.rpc("can_rectify_movimientos", { _bodega: bodegaId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo administradores o responsables pueden autorizar esta acción.");
}

// ===================== LOTES =====================

const LoteSchema = z.object({
  producto_id: z.string().uuid(),
  numero_lote: z.string().trim().min(1).max(80),
  proveedor: z.string().trim().max(120).nullable().optional(),
  fecha_recepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fecha_caducidad: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cantidad_inicial: z.number().min(0),
  cantidad_disponible: z.number().min(0).optional(),
  unidad: z.string().trim().min(1).max(20),
  coste_unitario: z.number().min(0).nullable().optional(),
  ubicacion: z.string().trim().max(120).nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
});

export const listLotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    producto_id: z.string().uuid().optional(),
    estado: z.enum(["disponible","agotado","caducado","bloqueado"]).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    let q = supabase.from("producto_lotes")
      .select("*, productos(id, nombre, categoria, unidad)")
      .eq("bodega_id", data.bodegaId)
      .order("fecha_caducidad", { ascending: true, nullsFirst: false });
    if (data.producto_id) q = q.eq("producto_id", data.producto_id);
    if (data.estado) q = q.eq("estado", data.estado);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: LoteSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const payload: any = { ...data.data, bodega_id: data.bodegaId };
    if (!data.id) {
      payload.cantidad_disponible = data.data.cantidad_disponible ?? data.data.cantidad_inicial;
      payload.created_by = userId;
    } else {
      payload.updated_by = userId;
      delete payload.cantidad_disponible; // no manipular stock manualmente al editar
    }
    const q = data.id
      ? supabase.from("producto_lotes").update(payload).eq("id", data.id).eq("bodega_id", data.bodegaId).select().single()
      : supabase.from("producto_lotes").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const bloquearLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid(),
    motivo: z.string().trim().min(3).max(500),
    desbloquear: z.boolean().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanRectify(supabase, data.bodegaId);
    const { data: row, error } = await supabase.from("producto_lotes")
      .update({
        estado: data.desbloquear ? "disponible" : "bloqueado",
        motivo_bloqueo: data.desbloquear ? null : data.motivo,
        updated_by: userId,
      })
      .eq("id", data.id).eq("bodega_id", data.bodegaId)
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("producto_lotes")
      .delete().eq("id", data.id).eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===================== STOCK =====================

export const listStockPorProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("stock_por_producto").select("*").eq("bodega_id", data.bodegaId)
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ===================== CONSUMOS =====================

const ConsumoSchema = z.object({
  producto_id: z.string().uuid(),
  lote_id: z.string().uuid(),
  cantidad: z.number().positive(),
  unidad: z.string().trim().min(1).max(20),
  trabajador_id: z.string().uuid().nullable().optional(),
  trabajo_id: z.string().uuid().nullable().optional(),
  deposito_id: z.string().max(80).nullable().optional(),
  elaboracion_id: z.string().uuid().nullable().optional(),
  movimiento_id: z.string().uuid().nullable().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  observaciones: z.string().max(500).nullable().optional(),
  uso_caducado_autorizado: z.boolean().optional(),
  motivo_autorizacion: z.string().max(500).nullable().optional(),
});

export const listConsumos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    trabajo_id: z.string().uuid().optional(),
    lote_id: z.string().uuid().optional(),
    producto_id: z.string().uuid().optional(),
    elaboracion_id: z.string().uuid().optional(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    let q = supabase.from("consumos_producto")
      .select("*, productos(id, nombre, unidad), producto_lotes(id, numero_lote, fecha_caducidad, estado)")
      .eq("bodega_id", data.bodegaId)
      .order("fecha", { ascending: false }).order("hora", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.trabajo_id) q = q.eq("trabajo_id", data.trabajo_id);
    if (data.lote_id) q = q.eq("lote_id", data.lote_id);
    if (data.producto_id) q = q.eq("producto_id", data.producto_id);
    if (data.elaboracion_id) q = q.eq("elaboracion_id", data.elaboracion_id);
    if (data.desde) q = q.gte("fecha", data.desde);
    if (data.hasta) q = q.lte("fecha", data.hasta);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createConsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), data: ConsumoSchema }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    if (data.data.uso_caducado_autorizado) {
      await assertCanRectify(supabase, data.bodegaId);
    }
    const payload: any = {
      ...data.data,
      bodega_id: data.bodegaId,
      created_by: userId,
      trabajador_id: data.data.trabajador_id ?? userId,
    };
    if (data.data.uso_caducado_autorizado) {
      payload.autorizado_por = userId;
      payload.autorizado_en = new Date().toISOString();
    }
    const { data: row, error } = await supabase.from("consumos_producto")
      .insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const anularConsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid(),
    motivo: z.string().trim().min(3).max(500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanRectify(supabase, data.bodegaId);
    // marcar anulado y devolver stock al lote
    const { data: c, error: e0 } = await supabase.from("consumos_producto")
      .select("*").eq("id", data.id).eq("bodega_id", data.bodegaId).single();
    if (e0) throw new Error(e0.message);
    if (c.anulado) throw new Error("El consumo ya está anulado");
    const { error: e1 } = await supabase.from("consumos_producto")
      .update({ anulado: true, motivo_anulacion: data.motivo }).eq("id", data.id);
    if (e1) throw new Error(e1.message);
    const { data: lote } = await supabase.from("producto_lotes")
      .select("cantidad_disponible, estado").eq("id", c.lote_id).single();
    if (lote) {
      const nuevo = Number(lote.cantidad_disponible) + Number(c.cantidad);
      await supabase.from("producto_lotes").update({
        cantidad_disponible: nuevo,
        estado: lote.estado === "agotado" ? "disponible" : lote.estado,
        updated_by: userId,
      }).eq("id", c.lote_id);
    }
    return { ok: true };
  });

// Comprobación para finalizar trabajo: valida que todos los consumos tengan
// producto, lote, cantidad>0, unidad, fecha, hora y que exista al menos un
// trabajador participante. Si el tipo del trabajo es "producto" se exige
// además al menos un consumo registrado.
export const trabajoConsumosCompletos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    trabajo_id: z.string().uuid(),
    intentoFinalizacion: z.boolean().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);

    const { data: trabajo, error: et } = await supabase.from("trabajos")
      .select("id, tipo, bodega_id").eq("id", data.trabajo_id).maybeSingle();
    if (et) throw new Error(et.message);
    if (!trabajo) throw new Error("Trabajo no encontrado");

    const { data: rows, error } = await supabase.from("consumos_producto")
      .select("id, producto_id, lote_id, cantidad, unidad, fecha, hora")
      .eq("trabajo_id", data.trabajo_id).eq("anulado", false);
    if (error) throw new Error(error.message);

    const { data: trabs } = await supabase.from("trabajo_trabajadores")
      .select("id").eq("trabajo_id", data.trabajo_id).limit(1);
    const hayTrabajador = (trabs?.length ?? 0) > 0;

    const total = rows?.length ?? 0;
    const motivos: string[] = [];
    let invalidos = 0;
    for (const c of rows ?? []) {
      const faltas: string[] = [];
      if (!c.producto_id) faltas.push("producto");
      if (!c.lote_id) faltas.push("lote");
      if (c.cantidad == null || Number(c.cantidad) <= 0) faltas.push("cantidad");
      if (!c.unidad) faltas.push("unidad");
      if (!c.fecha) faltas.push("fecha");
      if (!c.hora) faltas.push("hora");
      if (faltas.length) { invalidos++; motivos.push(`Consumo ${c.id.slice(0,8)}: falta ${faltas.join(", ")}`); }
    }
    if (total > 0 && !hayTrabajador) motivos.push("Sin trabajador asignado al trabajo");

    const requiere = trabajo.tipo === "producto" || total > 0;
    const completo = !requiere
      ? true
      : total > 0 && invalidos === 0 && hayTrabajador;

    if (data.intentoFinalizacion && !completo) {
      await supabase.from("auditoria").insert({
        bodega_id: trabajo.bodega_id,
        user_id: userId,
        accion: "FINALIZAR_TRABAJO_BLOQUEADO",
        tabla: "trabajos",
        registro_id: trabajo.id,
        payload: { requiere, total, invalidos, hayTrabajador, motivos } as any,
      });
    }

    return { requiere, completo, total, invalidos, validos: total - invalidos, hayTrabajador, motivos };
  });
