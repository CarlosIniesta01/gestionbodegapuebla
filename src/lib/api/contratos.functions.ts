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

async function assertCanWrite(supabase: any, bodegaId: string) {
  const { data, error } = await supabase.rpc("can_rectify_movimientos", { _bodega: bodegaId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo administradores o responsables");
}

const PartySchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  cif_nif: z.string().trim().max(40).nullable().optional(),
  direccion: z.string().trim().max(300).nullable().optional(),
  telefono: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  observaciones: z.string().trim().max(1000).nullable().optional(),
  activo: z.boolean().optional(),
});

// ========= CLIENTES =========
export const listClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any)
      .from("clientes").select("*").eq("bodega_id", data.bodegaId).order("nombre");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: PartySchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanWrite(supabase, data.bodegaId);
    const payload: any = { ...data.data, bodega_id: data.bodegaId };
    const q = data.id
      ? (supabase as any).from("clientes").update(payload).eq("id", data.id).select().single()
      : (supabase as any).from("clientes").insert({ ...payload, created_by: userId }).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, data.bodegaId);
    const { error } = await (context.supabase as any).from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========= PROVEEDORES =========
export const listProveedores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any)
      .from("proveedores").select("*").eq("bodega_id", data.bodegaId).order("nombre");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: PartySchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanWrite(supabase, data.bodegaId);
    const payload: any = { ...data.data, bodega_id: data.bodegaId };
    const q = data.id
      ? (supabase as any).from("proveedores").update(payload).eq("id", data.id).select().single()
      : (supabase as any).from("proveedores").insert({ ...payload, created_by: userId }).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, data.bodegaId);
    const { error } = await (context.supabase as any).from("proveedores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========= CONTRATOS =========
const ContratoBaseSchema = z.object({
  numero_contrato: z.string().trim().min(1).max(80),
  producto_id: z.string().uuid().nullable().optional(),
  campana: z.string().trim().max(40).nullable().optional(),
  litros_contratados: z.number().positive(),
  precio: z.number().nullable().optional(),
  fecha_contrato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  observaciones: z.string().trim().max(1000).nullable().optional(),
});

const CompraSchema = ContratoBaseSchema.extend({
  proveedor_id: z.string().uuid().nullable().optional(),
});
const VentaSchema = ContratoBaseSchema.extend({
  cliente_id: z.string().uuid().nullable().optional(),
});

export const listContratosCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any)
      .from("contratos_compra")
      .select("*, proveedores(id,nombre), productos_comerciales(id,nombre,codigo)")
      .eq("bodega_id", data.bodegaId)
      .order("fecha_contrato", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listContratosVenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any)
      .from("contratos_venta")
      .select("*, clientes(id,nombre), productos_comerciales(id,nombre,codigo)")
      .eq("bodega_id", data.bodegaId)
      .order("fecha_contrato", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertContratoCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: CompraSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanWrite(supabase, data.bodegaId);
    if (data.data.fecha_limite && data.data.fecha_limite < data.data.fecha_contrato) {
      throw new Error("La fecha límite no puede ser anterior a la fecha del contrato");
    }
    const payload: any = { ...data.data, bodega_id: data.bodegaId };
    const q = data.id
      ? (supabase as any).from("contratos_compra").update(payload).eq("id", data.id).select().single()
      : (supabase as any).from("contratos_compra").insert({ ...payload, created_by: userId }).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertContratoVenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    data: VentaSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanWrite(supabase, data.bodegaId);
    if (data.data.fecha_limite && data.data.fecha_limite < data.data.fecha_contrato) {
      throw new Error("La fecha límite no puede ser anterior a la fecha del contrato");
    }
    const payload: any = { ...data.data, bodega_id: data.bodegaId };
    const q = data.id
      ? (supabase as any).from("contratos_venta").update(payload).eq("id", data.id).select().single()
      : (supabase as any).from("contratos_venta").insert({ ...payload, created_by: userId }).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelarContratoCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, data.bodegaId);
    const { error } = await (context.supabase as any)
      .from("contratos_compra").update({ estado: "cancelado" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelarContratoVenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, data.bodegaId);
    const { error } = await (context.supabase as any)
      .from("contratos_venta").update({ estado: "cancelado" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHistorialContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    contratoId: z.string().uuid(),
    tipo: z.enum(["compra", "venta"]),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const col = data.tipo === "compra" ? "contrato_compra_id" : "contrato_venta_id";
    const { data: rows, error } = await (supabase as any)
      .from("movimientos")
      .select("*, productos_comerciales(id,nombre,codigo)")
      .eq("bodega_id", data.bodegaId)
      .eq(col, data.contratoId)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getAlertasContratos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const [{ data: cc }, { data: cv }] = await Promise.all([
      (supabase as any).from("contratos_compra").select("id,numero_contrato,fecha_limite,estado,litros_pendientes").eq("bodega_id", data.bodegaId).in("estado", ["pendiente", "parcial"]),
      (supabase as any).from("contratos_venta").select("id,numero_contrato,fecha_limite,estado,litros_pendientes").eq("bodega_id", data.bodegaId).in("estado", ["pendiente", "parcial"]),
    ]);
    const enrich = (rows: any[], tipo: string) => (rows ?? []).map((r) => ({
      ...r,
      tipo,
      vencido: r.fecha_limite && r.fecha_limite < today,
      por_vencer: r.fecha_limite && r.fecha_limite >= today && r.fecha_limite <= in30,
    }));
    return {
      compras: enrich(cc, "compra"),
      ventas: enrich(cv, "venta"),
    };
  });

export const getPosicionComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any)
      .from("v_posicion_comercial").select("*").eq("bodega_id", data.bodegaId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
