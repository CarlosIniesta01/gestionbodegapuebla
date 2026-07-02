import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Devuelve el conjunto completo de datos de trazabilidad para un lote de
 * producto enológico. Todo el motor de informes consume EXCLUSIVAMENTE este
 * DTO — nada de datos ficticios en el cliente.
 */
export const getTrazabilidadLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      loteId: z.string().uuid(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verificar membership al centro
    const { data: mem, error: memErr } = await supabase
      .from("memberships")
      .select("id, role_id, roles(key)")
      .eq("user_id", userId)
      .eq("bodega_id", data.bodegaId)
      .eq("estado", "activo")
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!mem) throw new Error("Sin acceso a este centro");
    const roleKey: string | undefined = (mem as any)?.roles?.key;

    // 1) Lote + producto
    const { data: lote, error: loteErr } = await supabase
      .from("producto_lotes")
      .select(
        "*, productos(id, nombre, categoria, tipo, unidad, fabricante, referencia, ficha_tecnica_url, ficha_seguridad_url)"
      )
      .eq("id", data.loteId)
      .eq("bodega_id", data.bodegaId)
      .maybeSingle();
    if (loteErr) throw new Error(loteErr.message);
    if (!lote) throw new Error("Lote no encontrado en este centro");

    // 2) Centro
    const { data: bodega } = await supabase
      .from("bodegas")
      .select("id, nombre, ubicacion")
      .eq("id", data.bodegaId)
      .maybeSingle();

    // 3) Consumos del lote — con relaciones amplias
    const { data: consumos, error: consErr } = await supabase
      .from("consumos_producto")
      .select(
        "id, fecha, hora, cantidad, unidad, deposito_id, trabajo_id, movimiento_id, elaboracion_id, trabajador_id, autorizado_por, uso_caducado_autorizado, motivo_autorizacion, observaciones, anulado, motivo_anulacion, created_at, created_by, contrato_compra_id, contrato_venta_id"
      )
      .eq("bodega_id", data.bodegaId)
      .eq("lote_id", data.loteId)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true, nullsFirst: true });
    if (consErr) throw new Error(consErr.message);

    const consumosSafe = consumos ?? [];

    // 4) IDs relacionados
    const trabajoIds = Array.from(new Set(consumosSafe.map((c) => c.trabajo_id).filter(Boolean))) as string[];
    const movimientoIds = Array.from(new Set(consumosSafe.map((c) => c.movimiento_id).filter(Boolean))) as string[];
    const elaboracionIds = Array.from(new Set(consumosSafe.map((c) => c.elaboracion_id).filter(Boolean))) as string[];
    const contratosCompraIds = Array.from(new Set(consumosSafe.map((c) => c.contrato_compra_id).filter(Boolean))) as string[];
    const contratosVentaIds = Array.from(new Set(consumosSafe.map((c) => c.contrato_venta_id).filter(Boolean))) as string[];
    const depositoIds = Array.from(new Set(consumosSafe.map((c) => c.deposito_id).filter(Boolean))) as string[];
    const trabajadorIds = Array.from(
      new Set(
        consumosSafe
          .flatMap((c) => [c.trabajador_id, c.autorizado_por, c.created_by])
          .filter(Boolean) as string[]
      )
    );

    // 5) Trabajos
    const trabajosP = trabajoIds.length
      ? supabase
          .from("trabajos")
          .select(
            "id, tipo, estado, prioridad, titulo, descripcion, deposito_origen, deposito_destino, scheduled_at, started_at, completed_at, created_at, created_by, asignado_a"
          )
          .in("id", trabajoIds)
      : Promise.resolve({ data: [] as any[] });

    // 6) Trabajadores participantes (todos los trabajos)
    const trabajadoresTrabajoP = trabajoIds.length
      ? supabase
          .from("trabajo_trabajadores")
          .select(
            "id, trabajo_id, trabajador_id, rol_en_trabajo, hora_inicio, hora_fin, estado_participacion, observaciones"
          )
          .in("trabajo_id", trabajoIds)
      : Promise.resolve({ data: [] as any[] });

    // 7) Movimientos
    const movimientosP = movimientoIds.length
      ? supabase
          .from("movimientos")
          .select(
            "id, fecha, hora, tipo, deposito_origen_id, deposito_destino_id, litros, grado, alcohol_absoluto, observaciones, estado_movimiento, trabajo_id, contrato_compra_id, contrato_venta_id, producto_id, productos_comerciales:producto_id(id, nombre, campana, tipo)"
          )
          .in("id", movimientoIds)
      : Promise.resolve({ data: [] as any[] });

    // 8) Elaboraciones
    const elaboracionesP = elaboracionIds.length
      ? supabase
          .from("elaboraciones")
          .select("id, nombre, fecha, lote_embotellado, observaciones, trabajo_id")
          .in("id", elaboracionIds)
      : Promise.resolve({ data: [] as any[] });

    // 9) Contratos
    const contratosCompraP = contratosCompraIds.length
      ? supabase
          .from("contratos_compra")
          .select(
            "id, numero_contrato, campana, litros_contratados, litros_retirados, fecha_contrato, estado, proveedor_id, proveedores:proveedor_id(id, nombre, cif_nif)"
          )
          .in("id", contratosCompraIds)
      : Promise.resolve({ data: [] as any[] });

    const contratosVentaP = contratosVentaIds.length
      ? supabase
          .from("contratos_venta")
          .select(
            "id, numero_contrato, campana, litros_contratados, litros_servidos, fecha_contrato, estado, cliente_id, clientes:cliente_id(id, nombre, cif_nif)"
          )
          .in("id", contratosVentaIds)
      : Promise.resolve({ data: [] as any[] });

    // 10) Perfiles (para operarios / autorizadores / created_by)
    const perfilesP = trabajadorIds.length
      ? supabase
          .from("profiles")
          .select("user_id, nombre, email")
          .in("user_id", trabajadorIds)
      : Promise.resolve({ data: [] as any[] });

    // 11) Auditoría del lote (por registro_id)
    const auditoriaLoteP = supabase
      .from("auditoria")
      .select("id, accion, tabla, registro_id, user_id, payload, created_at")
      .eq("bodega_id", data.bodegaId)
      .eq("tabla", "producto_lotes")
      .eq("registro_id", data.loteId)
      .order("created_at", { ascending: false })
      .limit(200);

    // 12) Auditoría de consumos ligados a este lote
    const auditoriaConsumosP = consumosSafe.length
      ? supabase
          .from("auditoria")
          .select("id, accion, tabla, registro_id, user_id, payload, created_at")
          .eq("bodega_id", data.bodegaId)
          .eq("tabla", "consumos_producto")
          .in(
            "registro_id",
            consumosSafe.map((c) => c.id)
          )
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as any[] });

    const [
      trabajosR,
      trabajadoresTrabajoR,
      movimientosR,
      elaboracionesR,
      contratosCompraR,
      contratosVentaR,
      perfilesR,
      auditoriaLoteR,
      auditoriaConsumosR,
    ] = await Promise.all([
      trabajosP,
      trabajadoresTrabajoP,
      movimientosP,
      elaboracionesP,
      contratosCompraP,
      contratosVentaP,
      perfilesP,
      auditoriaLoteP,
      auditoriaConsumosP,
    ] as any);

    // Perfiles auxiliares (autorizadores extra en auditoría)
    const perfilesMap = new Map<string, { nombre?: string; email?: string }>();
    for (const p of (perfilesR.data ?? []) as any[]) {
      perfilesMap.set(p.user_id, { nombre: p.nombre, email: p.email });
    }

    return {
      bodega,
      lote,
      consumos: consumosSafe,
      trabajos: (trabajosR.data ?? []) as any[],
      trabajadoresTrabajo: (trabajadoresTrabajoR.data ?? []) as any[],
      movimientos: (movimientosR.data ?? []) as any[],
      elaboraciones: (elaboracionesR.data ?? []) as any[],
      contratosCompra: (contratosCompraR.data ?? []) as any[],
      contratosVenta: (contratosVentaR.data ?? []) as any[],
      perfiles: Array.from(perfilesMap.entries()).map(([user_id, v]) => ({ user_id, ...v })),
      depositos: depositoIds,
      auditoriaLote: (auditoriaLoteR.data ?? []) as any[],
      auditoriaConsumos: (auditoriaConsumosR.data ?? []) as any[],
      roleKey,
    };
  });

export type TrazabilidadLoteDTO = Awaited<ReturnType<typeof getTrazabilidadLote>>;
