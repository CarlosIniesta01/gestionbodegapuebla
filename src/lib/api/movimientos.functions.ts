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
  contrato_compra_id: z.string().uuid().nullable().optional(),
  contrato_venta_id: z.string().uuid().nullable().optional(),
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

// Importación diaria de existencias reales (Excel). El Excel es el estado final de cada
// depósito; se regulariza con movimientos AJUSTE (nunca se tocan existencias directamente).
const MOTIVO_IMPORT = "IMPORTACIÓN DIARIA DE EXISTENCIAS DESDE EXCEL";
export const normProducto = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[\s\-_.\/]+/g, "");

export const importarExistencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    archivo: z.string().max(200).nullable().optional(),
    filasTotal: z.number().int().min(0).default(0),
    filasRechazadas: z.number().int().min(0).default(0),
    lineas: z.array(z.object({
      deposito_id: z.string().min(1).max(80),
      deposito_codigo: z.string().max(80).optional(),
      producto_id: z.string().uuid().nullable(),
      producto_nuevo: z.object({
        nombre: z.string().trim().min(1).max(120),
        campana: z.string().max(20).nullable().optional(),
        tipo: z.string().max(40).nullable().optional(),
        color: z.string().max(20).nullable().optional(),
      }).nullable().optional(),
      litros: z.number().min(0),
      grado: z.number().min(0).max(100).nullable(),
    })).min(1).max(2000),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    await assertCanRectify(supabase, data.bodegaId);
    const batchId = crypto.randomUUID();

    // 1) Crear productos nuevos (deduplicados por nombre normalizado)
    const { data: prods, error: ep } = await supabase.from("productos_comerciales")
      .select("id, nombre, codigo").eq("bodega_id", data.bodegaId);
    if (ep) throw new Error(ep.message);
    const byNorm = new Map<string, string>();
    const codigos = new Set<string>();
    (prods ?? []).forEach((p: any) => { byNorm.set(normProducto(p.nombre), p.id); codigos.add(String(p.codigo).toUpperCase()); });
    const creados: { id: string; nombre: string; codigo: string }[] = [];
    let seq = (prods?.length ?? 0) + 1;
    for (const l of data.lineas) {
      if (l.producto_id || !l.producto_nuevo || l.litros <= 0) continue;
      const k = normProducto(l.producto_nuevo.nombre);
      let id = byNorm.get(k);
      if (!id) {
        let codigo = "";
        do { codigo = `IMP-${String(seq++).padStart(4, "0")}`; } while (codigos.has(codigo));
        codigos.add(codigo);
        const { data: row, error } = await (supabase as any).from("productos_comerciales").insert({
          bodega_id: data.bodegaId, codigo, nombre: l.producto_nuevo.nombre.replace(/\s+/g, " ").trim(),
          campaña: l.producto_nuevo.campana || null, tipo: l.producto_nuevo.tipo || null,
          color: l.producto_nuevo.color || null, activo: true, created_by: userId,
          origen_creacion: "importacion_existencias",
        }).select("id, nombre, codigo").single();
        if (error) throw new Error(`No se pudo crear el producto "${l.producto_nuevo.nombre}": ${error.message}`);
        id = row.id as string;
        byNorm.set(k, id);
        creados.push(row);
      }
      l.producto_id = id;
    }

    // 2) Calcular ajustes por depósito
    const depIds = Array.from(new Set(data.lineas.map((l) => l.deposito_id)));
    const { data: actuales, error } = await supabase
      .from("existencias_actuales").select("*")
      .eq("bodega_id", data.bodegaId).in("deposito_id", depIds);
    if (error) throw new Error(error.message);
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = now.toTimeString().slice(0, 8);
    const obs = `${MOTIVO_IMPORT} · ${now.toISOString()} · usuario ${userId} · centro ${data.bodegaId} · lote ${batchId}`;
    const base = { bodega_id: data.bodegaId, tipo: "ajuste" as const, fecha, hora, observaciones: obs.slice(0, 500), created_by: userId, import_batch_id: batchId };
    const inserts: any[] = [];
    let sinCambios = 0, vaciados = 0, modificados = 0, lE = 0, lS = 0;
    const detalle: any[] = [];
    const salida = (dep: string, prod: string | null, litros: number, grado: number | null) => {
      inserts.push({ ...base, producto_id: prod, litros, grado, deposito_origen_id: dep, deposito_destino_id: null }); lS += litros;
    };
    const entrada = (dep: string, prod: string | null, litros: number, grado: number | null) => {
      inserts.push({ ...base, producto_id: prod, litros, grado, deposito_origen_id: null, deposito_destino_id: dep }); lE += litros;
    };
    for (const dep of depIds) {
      const objetivo = data.lineas.filter((l) => l.deposito_id === dep && l.litros > 0);
      const act = (actuales ?? []).filter((a: any) => a.deposito_id === dep && Math.abs(Number(a.litros)) > 0.0001);
      const antes = inserts.length;
      for (const a of act as any[]) {
        const l = Number(a.litros);
        const g = Number(a.grado_medio) || null;
        const o = objetivo.find((x) => (x.producto_id ?? null) === (a.producto_id ?? null));
        if (l < 0) { entrada(dep, a.producto_id, Math.abs(l), null); if (o) entrada(dep, o.producto_id, o.litros, o.grado); continue; }
        if (!o) { salida(dep, a.producto_id, l, g); continue; }
        const gradoDistinto = o.grado != null && Math.abs((g ?? 0) - o.grado) >= 0.005;
        if (gradoDistinto) { salida(dep, a.producto_id, l, g); entrada(dep, o.producto_id, o.litros, o.grado); continue; }
        const diff = Math.round((o.litros - l) * 100) / 100;
        if (diff > 0.009) entrada(dep, o.producto_id, diff, o.grado ?? g);
        else if (diff < -0.009) salida(dep, o.producto_id, -diff, g);
      }
      for (const o of objetivo) {
        if (!act.some((a: any) => (a.producto_id ?? null) === (o.producto_id ?? null))) entrada(dep, o.producto_id, o.litros, o.grado);
      }
      if (inserts.length === antes) sinCambios++;
      else { modificados++; if (!objetivo.length) vaciados++; }
      detalle.push({ deposito_id: dep, movimientos: inserts.length - antes });
    }
    for (let i = 0; i < inserts.length; i += 200) {
      const { error: e } = await (supabase as any).from("movimientos").insert(inserts.slice(i, i + 200));
      if (e) throw new Error(e.message);
    }
    const resumen = {
      batchId, productosCreados: creados, depositos: modificados, vaciados, sinCambios,
      movimientos: inserts.length, litrosEntrada: lE, litrosSalida: lS, filasIgnoradas: data.filasRechazadas,
    };
    await (supabase as any).from("importaciones_existencias").insert({
      id: batchId, bodega_id: data.bodegaId, user_id: userId, archivo: data.archivo ?? null,
      filas_total: data.filasTotal, filas_rechazadas: data.filasRechazadas, productos_creados: creados.length,
      depositos_modificados: modificados, depositos_vaciados: vaciados, sin_cambios: sinCambios,
      movimientos_generados: inserts.length, litros_entrada: lE, litros_salida: lS,
      productos_nuevos: creados, detalle,
    });
    return resumen;
  });

export const listImportacionesExistencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);
    const { data: rows, error } = await (supabase as any).from("importaciones_existencias")
      .select("*").eq("bodega_id", data.bodegaId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id, nombre, email").in("user_id", ids as string[]) : { data: [] as any[] };
    const pm = new Map((profs ?? []).map((p: any) => [p.user_id, p.nombre || p.email]));
    return (rows ?? []).map((r: any) => ({ ...r, usuario: pm.get(r.user_id) ?? "—" }));
  });
