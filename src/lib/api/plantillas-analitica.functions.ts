import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ParametroSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  parametro: z.string().min(1),
  unidad: z.string().optional().nullable(),
  minimo: z.number().optional().nullable(),
  maximo: z.number().optional().nullable(),
  obligatorio: z.boolean().default(false),
  metodo: z.string().optional().nullable(),
  orden: z.number().int().default(0),
});

export const listPlantillasAnalitica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      soloActivas: z.boolean().optional().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    let q = supabase
      .from("plantillas_analitica")
      .select("*, parametros:plantilla_analitica_parametros(*)")
      .eq("bodega_id", data.bodegaId)
      .order("es_default", { ascending: false })
      .order("nombre", { ascending: true });
    if (data.soloActivas) q = q.eq("activo", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // Ordena parámetros por 'orden'
    for (const r of rows ?? []) {
      (r.parametros ?? []).sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
    }
    return rows ?? [];
  });

export const getPlantillaAnalitica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { data: row, error } = await supabase
      .from("plantillas_analitica")
      .select("*, parametros:plantilla_analitica_parametros(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.parametros)
      (row.parametros as any[]).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    return row;
  });

export const upsertPlantillaAnalitica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional().nullable(),
      bodegaId: z.string().uuid(),
      nombre: z.string().min(1),
      categoriaProducto: z.string().optional().nullable(),
      descripcion: z.string().optional().nullable(),
      activo: z.boolean().default(true),
      esDefault: z.boolean().default(false),
      parametros: z.array(ParametroSchema).default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const userId = context.userId;
    const payload: any = {
      bodega_id: data.bodegaId,
      nombre: data.nombre,
      categoria_producto: data.categoriaProducto ?? null,
      descripcion: data.descripcion ?? null,
      activo: data.activo,
      es_default: data.esDefault,
    };
    let plantillaId = data.id ?? null;
    if (plantillaId) {
      const { error } = await supabase
        .from("plantillas_analitica")
        .update(payload)
        .eq("id", plantillaId);
      if (error) throw new Error(error.message);
    } else {
      payload.created_by = userId;
      const { data: row, error } = await supabase
        .from("plantillas_analitica")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      plantillaId = row.id as string;
    }
    // Reemplazar parámetros (simple y auditable)
    await supabase
      .from("plantilla_analitica_parametros")
      .delete()
      .eq("plantilla_id", plantillaId);
    if (data.parametros.length) {
      const inserts = data.parametros.map((p, i) => ({
        plantilla_id: plantillaId,
        parametro: p.parametro,
        unidad: p.unidad ?? null,
        minimo: p.minimo ?? null,
        maximo: p.maximo ?? null,
        obligatorio: p.obligatorio,
        metodo: p.metodo ?? null,
        orden: p.orden ?? i,
      }));
      const { error } = await supabase
        .from("plantilla_analitica_parametros")
        .insert(inserts);
      if (error) throw new Error(error.message);
    }
    return { id: plantillaId };
  });

export const deletePlantillaAnalitica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { error } = await supabase
      .from("plantillas_analitica")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
