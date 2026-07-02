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
