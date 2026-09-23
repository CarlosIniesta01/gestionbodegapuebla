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

// ============================================================================
// FASE 2 · BLOQUE A — Validaciones, transiciones controladas y resumen
// ============================================================================

type ValidationError = {
  code: string;
  bloque: string;
  message: string;
  critico: boolean;
};

async function loadOrdenBundle(supabase: any, ordenId: string) {
  const { data: orden, error } = await supabase
    .from("ordenes_logisticas")
    .select("*")
    .eq("id", ordenId)
    .single();
  if (error) throw new Error(error.message);
  const [{ data: comps }, { data: anals }, { data: bod }] = await Promise.all([
    supabase.from("orden_compartimentos").select("*").eq("orden_id", ordenId).order("numero"),
    supabase.from("analiticas_lote").select("*").eq("orden_logistica_id", ordenId),
    supabase.from("bodegas").select("id, tolerancia_compartimentos_pct").eq("id", orden.bodega_id).single(),
  ]);
  return { orden, comps: comps ?? [], anals: anals ?? [], bodega: bod ?? { tolerancia_compartimentos_pct: 0.5 } };
}

async function computeValidation(supabase: any, ordenId: string) {
  const { orden, comps, anals, bodega } = await loadOrdenBundle(supabase, ordenId);
  const errors: ValidationError[] = [];
  const push = (e: ValidationError) => errors.push(e);
  const isCarga = orden.tipo === "carga";

  // Generales
  if (!orden.bodega_id) push({ code: "bodega", bloque: "generales", message: "Centro no válido", critico: true });
  if (!orden.producto_id) push({ code: "producto", bloque: "producto", message: "Producto no seleccionado", critico: true });
  if (isCarga && !orden.deposito_origen_id) push({ code: "dep_origen", bloque: "deposito", message: "Depósito origen no seleccionado", critico: true });
  if (!isCarga && !orden.deposito_destino_id) push({ code: "dep_destino", bloque: "deposito", message: "Depósito destino no seleccionado", critico: true });
  if (orden.litros_reales == null || Number(orden.litros_reales) <= 0)
    push({ code: "litros_reales", bloque: "generales", message: "Litros reales debe ser mayor que 0", critico: true });

  // Compartimentos: suma vs total con tolerancia
  const totalReal = Number(orden.litros_reales ?? 0);
  if (comps.length > 0 && totalReal > 0) {
    const suma = comps.reduce((s: number, c: any) => s + Number(c.litros_reales ?? 0), 0);
    const tol = (Number(bodega.tolerancia_compartimentos_pct ?? 0.5) / 100) * totalReal;
    if (Math.abs(suma - totalReal) > tol) {
      push({
        code: "compartimentos_suma",
        bloque: "compartimentos",
        message: `Suma de compartimentos (${suma.toFixed(2)} L) no cuadra con litros reales (${totalReal.toFixed(2)} L, tolerancia ±${tol.toFixed(2)} L)`,
        critico: true,
      });
    }
  }

  // Existencias / capacidad
  const depositoRef = isCarga ? orden.deposito_origen_id : orden.deposito_destino_id;
  let existenciasActuales: number | null = null;
  let capacidadDeposito: number | null = null;
  if (depositoRef && orden.producto_id) {
    const { data: ex } = await supabase
      .from("existencias_actuales")
      .select("litros")
      .eq("bodega_id", orden.bodega_id)
      .eq("deposito_id", depositoRef)
      .eq("producto_id", orden.producto_id)
      .maybeSingle();
    existenciasActuales = ex?.litros != null ? Number(ex.litros) : 0;
    if (isCarga && existenciasActuales! < totalReal) {
      push({
        code: "sin_stock",
        bloque: "deposito",
        message: `Existencias insuficientes: disponibles ${existenciasActuales} L, se intentan cargar ${totalReal} L`,
        critico: true,
      });
    }
  }
  if (!isCarga && depositoRef) {
    const { data: bmap } = await supabase.from("bodega_maps").select("data").eq("bodega_id", orden.bodega_id).maybeSingle();
    const depNode = (bmap?.data?.depositos ?? []).find((d: any) => d.id === depositoRef || d.codigo === depositoRef);
    capacidadDeposito = depNode?.capacidad != null ? Number(depNode.capacidad) : null;
    // Suma total actual del depósito (todos los productos)
    const { data: exAll } = await supabase
      .from("existencias_actuales")
      .select("litros")
      .eq("bodega_id", orden.bodega_id)
      .eq("deposito_id", depositoRef);
    const litrosActualesDep = (exAll ?? []).reduce((s: number, r: any) => s + Number(r.litros ?? 0), 0);
    if (capacidadDeposito != null && litrosActualesDep + totalReal > capacidadDeposito) {
      push({
        code: "sobre_capacidad",
        bloque: "deposito",
        message: `Depósito destino sobrepasado: actual ${litrosActualesDep} L + descarga ${totalReal} L = ${litrosActualesDep + totalReal} L, capacidad ${capacidadDeposito} L`,
        critico: true,
      });
    }
  }

  // Laboratorio
  if (orden.lab_estado !== "autorizado") {
    push({ code: "lab_no_autorizado", bloque: "laboratorio", message: "Laboratorio no ha autorizado la orden", critico: true });
  }

  // Analíticas obligatorias
  const obligatoriasIncorrectas = anals.filter((a: any) => a.obligatorio && (a.resultado_estado === "pendiente" || a.resultado_estado === "no_conforme"));
  const excepcionOk = orden.lab_excepcion && orden.lab_excepcion.motivo && orden.lab_excepcion.autorizado_por;
  if (obligatoriasIncorrectas.length > 0 && !excepcionOk) {
    push({
      code: "analiticas_pendientes",
      bloque: "laboratorio",
      message: `Hay ${obligatoriasIncorrectas.length} analítica(s) obligatoria(s) pendiente(s) o no conforme(s)`,
      critico: true,
    });
  }

  // Comprobaciones obligatorias (solo carga)
  if (isCarga && Array.isArray(orden.comprobaciones)) {
    const noConformes = orden.comprobaciones.filter((c: any) => c.estado === "" || c.estado === "no_conforme" || !c.estado);
    if (noConformes.length > 0) {
      push({
        code: "comprobaciones_pendientes",
        bloque: "laboratorio",
        message: `Comprobaciones previas incompletas: ${noConformes.length} pendiente(s) o no conforme(s)`,
        critico: true,
      });
    }
  }

  // Transporte
  if (!orden.conductor_nombre) push({ code: "conductor", bloque: "transporte", message: "Conductor no identificado", critico: true });
  if (!orden.matricula) push({ code: "matricula", bloque: "transporte", message: "Matrícula no informada", critico: true });

  // Operarios: chequeo básico via trabajo vinculado
  if (orden.trabajo_id) {
    const { count } = await supabase
      .from("trabajo_trabajadores")
      .select("id", { count: "exact", head: true })
      .eq("trabajo_id", orden.trabajo_id);
    if (!count || count === 0) push({ code: "operarios", bloque: "operarios", message: "No hay operarios asignados al trabajo vinculado", critico: true });
  } else {
    push({ code: "trabajo", bloque: "operarios", message: "Orden sin trabajo vinculado", critico: false });
  }

  // Contratos
  if (isCarga && orden.contrato_venta_id) {
    const { data: cv } = await supabase.from("contratos_venta").select("litros_pendientes, producto_id, estado").eq("id", orden.contrato_venta_id).maybeSingle();
    if (cv) {
      if (cv.estado === "cancelado") push({ code: "contrato_cancelado", bloque: "contrato", message: "Contrato de venta cancelado", critico: true });
      if (cv.producto_id && orden.producto_id && cv.producto_id !== orden.producto_id)
        push({ code: "contrato_producto", bloque: "contrato", message: "Producto no coincide con el contrato de venta", critico: true });
      if (Number(cv.litros_pendientes ?? 0) < totalReal)
        push({ code: "contrato_pendientes", bloque: "contrato", message: `Contrato de venta con ${cv.litros_pendientes} L pendientes < ${totalReal} L a cargar`, critico: true });
    }
  }
  if (!isCarga && orden.contrato_compra_id) {
    const { data: cc } = await supabase.from("contratos_compra").select("litros_pendientes, producto_id, estado").eq("id", orden.contrato_compra_id).maybeSingle();
    if (cc) {
      if (cc.estado === "cancelado") push({ code: "contrato_cancelado", bloque: "contrato", message: "Contrato de compra cancelado", critico: true });
      if (cc.producto_id && orden.producto_id && cc.producto_id !== orden.producto_id)
        push({ code: "contrato_producto", bloque: "contrato", message: "Producto no coincide con el contrato de compra", critico: true });
      if (Number(cc.litros_pendientes ?? 0) < totalReal)
        push({ code: "contrato_pendientes", bloque: "contrato", message: `Contrato de compra con ${cc.litros_pendientes} L pendientes < ${totalReal} L a descargar`, critico: true });
    }
  }

  return {
    ok: errors.filter((e) => e.critico).length === 0,
    errors,
    resumen: {
      tipo: orden.tipo,
      totalReal,
      existenciasActuales,
      capacidadDeposito,
      analiticasObligatoriasPendientes: obligatoriasIncorrectas.length,
      excepcionLaboratorio: excepcionOk ? orden.lab_excepcion : null,
      contratoCompraId: orden.contrato_compra_id,
      contratoVentaId: orden.contrato_venta_id,
    },
    orden,
    comps,
    anals,
  };
}

export const validarOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    return await computeValidation(supabase, data.id);
  });

export const getResumenOrden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const val = await computeValidation(supabase, data.id);
    // Enriquecer con datos de contrato
    let contrato: any = null;
    if (val.orden.tipo === "carga" && val.orden.contrato_venta_id) {
      const { data: cv } = await supabase.from("contratos_venta").select("*").eq("id", val.orden.contrato_venta_id).maybeSingle();
      contrato = cv;
    } else if (val.orden.tipo === "descarga" && val.orden.contrato_compra_id) {
      const { data: cc } = await supabase.from("contratos_compra").select("*").eq("id", val.orden.contrato_compra_id).maybeSingle();
      contrato = cc;
    }
    return { validation: val, contrato };
  });

async function assertPermiso(supabase: any, bodegaId: string, permKey: string) {
  const { data, error } = await supabase.rpc("has_permission", { _bodega: bodegaId, _perm: permKey });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Permiso requerido: ${permKey}`);
}

export const iniciarOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { data: orden, error } = await supabase.from("ordenes_logisticas").select("id, bodega_id, tipo, estado").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    if (orden.estado !== "autorizada") throw new Error(`No puede iniciarse desde estado "${orden.estado}"`);
    const permKey = orden.tipo === "carga" ? "ordenes.carga.iniciar" : "ordenes.descarga.iniciar";
    await assertPermiso(supabase, orden.bodega_id, permKey);
    const now = new Date().toISOString();
    const { error: ue } = await supabase
      .from("ordenes_logisticas")
      .update({ estado: "en_proceso", fecha_inicio_real: now, iniciado_at: now, iniciado_por: context.userId, updated_by: context.userId })
      .eq("id", data.id);
    if (ue) throw new Error(ue.message);
    return { ok: true };
  });

export const marcarPendienteConfirmacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const val = await computeValidation(supabase, data.id);
    if (!val.ok) {
      const critics = val.errors.filter((e) => e.critico);
      throw new Error(`Validaciones bloqueantes: ${critics.map((e) => e.message).join(" · ")}`);
    }
    if (val.orden.estado !== "en_proceso") throw new Error(`No puede pasar a pendiente de confirmación desde "${val.orden.estado}"`);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("ordenes_logisticas")
      .update({
        estado: "pendiente_confirmacion",
        pendiente_confirmacion_at: now,
        fecha_fin_real: now,
        validation_snapshot: val.resumen,
        updated_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rechazarOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), motivo: z.string().min(3) }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("ordenes_logisticas")
      .update({
        estado: "rechazada",
        rechazada_at: now,
        rechazada_por: context.userId,
        motivo_rechazo: data.motivo,
        updated_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const aplicarExcepcionLaboratorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      motivo: z.string().min(3),
      observaciones: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { data: orden, error } = await supabase.from("ordenes_logisticas").select("id, bodega_id").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    await assertPermiso(supabase, orden.bodega_id, "laboratorio.ordenes.authorize");
    const now = new Date().toISOString();
    const excepcion = {
      motivo: data.motivo,
      observaciones: data.observaciones ?? null,
      autorizado_por: context.userId,
      autorizado_at: now,
    };
    const { error: ue } = await supabase
      .from("ordenes_logisticas")
      .update({ lab_excepcion: excepcion, updated_by: context.userId })
      .eq("id", data.id);
    if (ue) throw new Error(ue.message);
    // Auditoría
    await supabase.from("auditoria").insert({
      bodega_id: orden.bodega_id,
      user_id: context.userId,
      accion: "ORDEN_LAB_EXCEPCION",
      tabla: "ordenes_logisticas",
      registro_id: data.id,
      payload: { excepcion },
    });
    return { ok: true, excepcion };
  });

// ============================================================================
// FASE 2 · BLOQUE B — Confirmación atómica (crea movimiento, cierra orden)
// ============================================================================

export const confirmarOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      idempotencyKey: z.string().uuid().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    // Re-validar antes de invocar la RPC atómica
    const val = await computeValidation(supabase, data.id);
    if (!val.ok) {
      const critics = val.errors.filter((e) => e.critico);
      throw new Error(`Validaciones bloqueantes: ${critics.map((e) => e.message).join(" · ")}`);
    }
    const { data: res, error } = await supabase.rpc("confirmar_orden_logistica", {
      _orden_id: data.id,
      _idempotency_key: data.idempotencyKey ?? null,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; idempotent: boolean; movimiento_id: string; estado: string };
  });



// ============================================================================
// FASE 2 · BLOQUE C — Rectificación de órdenes cerradas
// ============================================================================

export const rectificarOrdenLogistica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      modo: z.enum(["informativa", "operativa"]),
      motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
      cambios: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const cambios: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.cambios ?? {})) {
      if (v === null || v === undefined || v === "") continue;
      cambios[k] = String(v);
    }
    const { data: res, error } = await supabase.rpc("rectificar_orden_logistica", {
      _orden_id: data.id,
      _modo: data.modo,
      _motivo: data.motivo,
      _cambios: cambios,
    });
    if (error) throw new Error(error.message);
    return res as {
      ok: boolean;
      modo: "informativa" | "operativa";
      movimiento_id: string | null;
      movimiento_anterior?: string;
      estado: string;
    };
  });
