import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PARAMETROS_ANALITICA = [
  "Grado alcohólico",
  "pH",
  "Acidez total",
  "Acidez volátil",
  "SO2 libre",
  "SO2 total",
  "Densidad",
  "Azúcares",
  "Color",
  "Turbidez",
  "Otros",
] as const;

const AnalitEventoParam = z.object({
  parametro: z.string().min(1),
  valor: z.number().optional().nullable(),
  valorTexto: z.string().optional().nullable(),
  unidad: z.string().optional().nullable(),
  minimo: z.number().optional().nullable(),
  maximo: z.number().optional().nullable(),
  metodo: z.string().optional().nullable(),
  obligatorio: z.boolean().default(false),
  resultadoEstado: z.enum(["conforme", "no_conforme", "pendiente"]).default("pendiente"),
  observaciones: z.string().optional().nullable(),
  orden: z.number().int().default(0),
});

export const listAnaliticasEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ eventoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { data: rows, error } = await supabase
      .from("analiticas_lote")
      .select("*")
      .eq("evento_id", data.eventoId)
      .order("orden_num", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const bulkUpsertAnaliticasEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      eventoId: z.string().uuid(),
      loteId: z.string().uuid(),
      productoId: z.string().uuid().optional().nullable(),
      depositoId: z.string().uuid().optional().nullable(),
      plantillaId: z.string().uuid().optional().nullable(),
      fecha: z.string().min(1),
      parametros: z.array(AnalitEventoParam),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const userId = context.userId;
    // Reemplaza todas las analíticas asociadas al evento (auditadas)
    await supabase.from("analiticas_lote").delete().eq("evento_id", data.eventoId);
    if (!data.parametros.length) return { ok: true, inserted: 0 };
    const inserts = data.parametros.map((p, i) => ({
      bodega_id: data.bodegaId,
      lote_id: data.loteId,
      producto_id: data.productoId ?? null,
      deposito_id: data.depositoId ?? null,
      evento_id: data.eventoId,
      plantilla_id: data.plantillaId ?? null,
      fecha: data.fecha,
      parametro: p.parametro,
      valor: p.valor ?? null,
      valor_texto: p.valorTexto ?? null,
      unidad: p.unidad ?? null,
      minimo: p.minimo ?? null,
      maximo: p.maximo ?? null,
      metodo: p.metodo ?? null,
      obligatorio: p.obligatorio,
      orden_num: p.orden ?? i,
      resultado_estado: p.resultadoEstado,
      observaciones: p.observaciones ?? null,
      realizado_por: userId,
      created_by: userId,
      updated_by: userId,
    }));
    const { error } = await supabase.from("analiticas_lote").insert(inserts);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: inserts.length };
  });

export const listAnaliticasLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      loteId: z.string().uuid(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("analiticas_lote")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .eq("lote_id", data.loteId)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAnaliticaLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      loteId: z.string().uuid(),
      productoId: z.string().uuid().optional().nullable(),
      depositoId: z.string().uuid().optional().nullable(),
      fecha: z.string().min(1),
      parametro: z.string().min(1),
      valor: z.number().optional().nullable(),
      valorTexto: z.string().optional().nullable(),
      unidad: z.string().optional().nullable(),
      resultadoEstado: z.enum(["conforme", "no_conforme", "pendiente"]),
      observaciones: z.string().optional().nullable(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("analiticas_lote")
      .insert({
        bodega_id: data.bodegaId,
        lote_id: data.loteId,
        producto_id: data.productoId ?? null,
        deposito_id: data.depositoId ?? null,
        fecha: data.fecha,
        parametro: data.parametro,
        valor: data.valor ?? null,
        valor_texto: data.valorTexto ?? null,
        unidad: data.unidad ?? null,
        resultado_estado: data.resultadoEstado,
        observaciones: data.observaciones ?? null,
        realizado_por: userId,
        created_by: userId,
        updated_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAnaliticaLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("analiticas_lote").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AnaliticaLoteRow = Awaited<ReturnType<typeof listAnaliticasLote>>[number];
