import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoEnum = z.enum(["carga", "descarga"]);
const EstadoEnum = z.enum([
  "borrador",
  "programada",
  "pendiente_laboratorio",
  "autorizada",
  "en_proceso",
  "pendiente_confirmacion",
  "completada",
  "cerrada",
  "rechazada",
  "cancelada",
  "rectificada",
]);

async function assertMember(supabase: any, bodegaId: string, userId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not a member of this bodega");
}

export const listOrdenesLogisticas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      tipo: TipoEnum.optional(),
      estado: EstadoEnum.optional(),
      limit: z.number().min(1).max(200).default(100),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    let q = supabase
      .from("ordenes_logisticas")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .order("fecha_programada", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.estado) q = q.eq("estado", data.estado);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { data: orden, error } = await supabase
      .from("ordenes_logisticas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!orden) throw new Error("Orden no encontrada");
    const [{ data: comps }, { data: anals }] = await Promise.all([
      supabase.from("orden_compartimentos").select("*").eq("orden_id", data.id).order("numero"),
      supabase.from("analiticas_lote").select("*").eq("orden_logistica_id", data.id).order("orden_num"),
    ]);
    return { orden, compartimentos: comps ?? [], analiticas: anals ?? [] };
  });

const OrdenPayload = z.object({
  id: z.string().uuid().optional().nullable(),
  bodegaId: z.string().uuid(),
  trabajoId: z.string().uuid().optional().nullable(),
  calendarioEventoId: z.string().uuid().optional().nullable(),
  tipo: TipoEnum,
  estado: EstadoEnum.default("borrador"),
  prioridad: z.string().default("normal"),
  procesoDocumentalId: z.string().uuid().optional().nullable(),
  procesoCodigoSnapshot: z.string().optional().nullable(),
  procesoVersionSnapshot: z.string().optional().nullable(),
  procesoNombreSnapshot: z.string().optional().nullable(),
  numeroOperacion: z.string().optional().nullable(),
  fechaProgramada: z.string().optional().nullable(),
  horaProgramada: z.string().optional().nullable(),
  fechaInicioReal: z.string().optional().nullable(),
  fechaFinReal: z.string().optional().nullable(),
  productoId: z.string().uuid().optional().nullable(),
  loteId: z.string().uuid().optional().nullable(),
  categoria: z.string().optional().nullable(),
  campana: z.string().optional().nullable(),
  depositoOrigenId: z.string().optional().nullable(),
  depositoDestinoId: z.string().optional().nullable(),
  litrosPrevistos: z.number().optional().nullable(),
  litrosReales: z.number().optional().nullable(),
  grado: z.number().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
  proveedorId: z.string().uuid().optional().nullable(),
  contratoCompraId: z.string().uuid().optional().nullable(),
  contratoVentaId: z.string().uuid().optional().nullable(),
  transportista: z.string().optional().nullable(),
  empresaTransportista: z.string().optional().nullable(),
  matricula: z.string().optional().nullable(),
  remolqueMatricula: z.string().optional().nullable(),
  conductorNombre: z.string().optional().nullable(),
  conductorDocumento: z.string().optional().nullable(),
  conductorTelefono: z.string().optional().nullable(),
  numeroPrecinto: z.string().optional().nullable(),
  precintosAdicionales: z.string().optional().nullable(),
  comprobaciones: z.array(z.any()).default([]),
  instrucciones: z.record(z.string(), z.any()).default({}),
  limpiezaEpis: z.record(z.string(), z.any()).default({}),
  declaracionTransportista: z.record(z.string(), z.any()).default({}),
  labEstado: z.enum(["pendiente", "autorizado", "rechazado"]).default("pendiente"),
  labAutorizadoCargo: z.string().optional().nullable(),
  labObservaciones: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  motivoCancelacion: z.string().optional().nullable(),
  compartimentos: z
    .array(
      z.object({
        numero: z.number(),
        productoId: z.string().uuid().optional().nullable(),
        loteId: z.string().uuid().optional().nullable(),
        depositoId: z.string().optional().nullable(),
        litrosPrevistos: z.number().optional().nullable(),
        litrosReales: z.number().optional().nullable(),
        observaciones: z.string().optional().nullable(),
      }),
    )
    .default([]),
});

function toDbPayload(data: z.infer<typeof OrdenPayload>, userId: string) {
  return {
    bodega_id: data.bodegaId,
    trabajo_id: data.trabajoId ?? null,
    calendario_evento_id: data.calendarioEventoId ?? null,
    tipo: data.tipo,
    estado: data.estado,
    prioridad: data.prioridad,
    proceso_documental_id: data.procesoDocumentalId ?? null,
    proceso_codigo_snapshot: data.procesoCodigoSnapshot ?? null,
    proceso_version_snapshot: data.procesoVersionSnapshot ?? null,
    proceso_nombre_snapshot: data.procesoNombreSnapshot ?? null,
    numero_operacion: data.numeroOperacion ?? null,
    fecha_programada: data.fechaProgramada ?? null,
    hora_programada: data.horaProgramada ?? null,
    fecha_inicio_real: data.fechaInicioReal ?? null,
    fecha_fin_real: data.fechaFinReal ?? null,
    producto_id: data.productoId ?? null,
    lote_id: data.loteId ?? null,
    categoria: data.categoria ?? null,
    campana: data.campana ?? null,
    deposito_origen_id: data.depositoOrigenId ?? null,
    deposito_destino_id: data.depositoDestinoId ?? null,
    litros_previstos: data.litrosPrevistos ?? null,
    litros_reales: data.litrosReales ?? null,
    grado: data.grado ?? null,
    cliente_id: data.clienteId ?? null,
    proveedor_id: data.proveedorId ?? null,
    contrato_compra_id: data.contratoCompraId ?? null,
    contrato_venta_id: data.contratoVentaId ?? null,
    transportista: data.transportista ?? null,
    empresa_transportista: data.empresaTransportista ?? null,
    matricula: data.matricula ?? null,
    remolque_matricula: data.remolqueMatricula ?? null,
    conductor_nombre: data.conductorNombre ?? null,
    conductor_documento: data.conductorDocumento ?? null,
    conductor_telefono: data.conductorTelefono ?? null,
    numero_precinto: data.numeroPrecinto ?? null,
    precintos_adicionales: data.precintosAdicionales ?? null,
    comprobaciones: data.comprobaciones,
    instrucciones: data.instrucciones,
    limpieza_epis: data.limpiezaEpis,
    declaracion_transportista: data.declaracionTransportista,
    lab_estado: data.labEstado,
    lab_autorizado_cargo: data.labAutorizadoCargo ?? null,
    lab_observaciones: data.labObservaciones ?? null,
    observaciones: data.observaciones ?? null,
    motivo_cancelacion: data.motivoCancelacion ?? null,
    updated_by: userId,
  };
}

export const upsertOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OrdenPayload)
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const userId = context.userId;
    await assertMember(supabase, data.bodegaId, userId);

    const payload = toDbPayload(data, userId);
    let ordenId = data.id ?? null;

    if (ordenId) {
      const { error } = await supabase.from("ordenes_logisticas").update(payload).eq("id", ordenId);
      if (error) throw new Error(error.message);
    } else {
      const insertPayload: any = { ...payload, created_by: userId };
      // Auto-create linked trabajo if not provided so orden inherits Trabajos infra
      if (!insertPayload.trabajo_id) {
        const titulo = `${data.tipo === "carga" ? "Orden de carga" : "Orden de descarga"}${data.numeroOperacion ? ` · ${data.numeroOperacion}` : ""}`;
        const { data: trab, error: te } = await supabase
          .from("trabajos")
          .insert({
            bodega_id: data.bodegaId,
            tipo: data.tipo,
            titulo,
            estado: "pendiente",
            prioridad: data.prioridad,
            scheduled_at: data.fechaProgramada
              ? new Date(`${data.fechaProgramada}T${data.horaProgramada ?? "09:00"}`).toISOString()
              : null,
            datos: { numero_operacion: data.numeroOperacion ?? null },
            created_by: userId,
          })
          .select("id")
          .single();
        if (te) throw new Error(te.message);
        insertPayload.trabajo_id = trab.id;
      }
      const { data: row, error } = await supabase
        .from("ordenes_logisticas")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      ordenId = row.id;
    }

    // Reset & persist compartimentos
    if (ordenId) {
      await supabase.from("orden_compartimentos").delete().eq("orden_id", ordenId);
      if (data.compartimentos.length) {
        const rows = data.compartimentos.map((c) => ({
          orden_id: ordenId,
          numero: c.numero,
          producto_id: c.productoId ?? null,
          lote_id: c.loteId ?? null,
          deposito_id: c.depositoId ?? null,
          litros_previstos: c.litrosPrevistos ?? null,
          litros_reales: c.litrosReales ?? null,
          observaciones: c.observaciones ?? null,
        }));
        const { error } = await supabase.from("orden_compartimentos").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    return { id: ordenId };
  });

export const changeOrdenEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      estado: EstadoEnum,
      motivo: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const patch: any = { estado: data.estado, updated_by: context.userId };
    if (data.estado === "en_proceso") patch.fecha_inicio_real = new Date().toISOString();
    if (data.estado === "completada") patch.fecha_fin_real = new Date().toISOString();
    if (data.estado === "cancelada") {
      if (!data.motivo) throw new Error("Motivo de cancelación requerido");
      patch.motivo_cancelacion = data.motivo;
    }
    const { error } = await supabase.from("ordenes_logisticas").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const authorizeOrdenLab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      estado: z.enum(["pendiente", "autorizado", "rechazado"]),
      cargo: z.string().optional().nullable(),
      observaciones: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const patch: any = {
      lab_estado: data.estado,
      lab_autorizado_cargo: data.cargo ?? null,
      lab_observaciones: data.observaciones ?? null,
      updated_by: context.userId,
    };
    if (data.estado === "autorizado" || data.estado === "rechazado") {
      patch.lab_autorizado_por = context.userId;
      patch.lab_autorizado_at = new Date().toISOString();
    } else {
      patch.lab_autorizado_por = null;
      patch.lab_autorizado_at = null;
    }
    const { error } = await supabase.from("ordenes_logisticas").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { error } = await supabase.from("ordenes_logisticas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const userId = context.userId;
    const { data: orig, error } = await supabase
      .from("ordenes_logisticas")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, trabajo_id, calendario_evento_id, ...copy } = orig;
    copy.estado = "borrador";
    copy.numero_operacion = null;
    copy.fecha_inicio_real = null;
    copy.fecha_fin_real = null;
    copy.movimiento_id = null;
    copy.lab_estado = "pendiente";
    copy.lab_autorizado_por = null;
    copy.lab_autorizado_at = null;
    copy.created_by = userId;
    copy.updated_by = userId;
    const { data: nueva, error: ie } = await supabase
      .from("ordenes_logisticas")
      .insert(copy)
      .select("id")
      .single();
    if (ie) throw new Error(ie.message);
    // Clone compartimentos
    const { data: comps } = await supabase.from("orden_compartimentos").select("*").eq("orden_id", data.id);
    if (comps?.length) {
      const rows = comps.map(({ id: _id, created_at: _c, updated_at: _u, orden_id: _o, ...rest }: any) => ({
        ...rest,
        orden_id: nueva.id,
      }));
      await supabase.from("orden_compartimentos").insert(rows);
    }
    return { id: nueva.id };
  });
