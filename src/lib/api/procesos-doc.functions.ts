import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoEnum = z.enum(["carga", "descarga"]);

export const listProcesosDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bodegaId: z.string().uuid(),
      tipo: TipoEnum.optional(),
      soloActivos: z.boolean().optional().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    let q = supabase
      .from("procesos_documentales")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .order("es_default", { ascending: false })
      .order("codigo", { ascending: true });
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.soloActivos) q = q.eq("activo", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertProcesoDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional().nullable(),
      bodegaId: z.string().uuid(),
      codigo: z.string().min(1),
      nombre: z.string().min(1),
      tipo: TipoEnum,
      categoriaProducto: z.string().optional().nullable(),
      productoId: z.string().uuid().optional().nullable(),
      descripcion: z.string().optional().nullable(),
      activo: z.boolean().default(true),
      version: z.string().default("1"),
      fechaVigencia: z.string().optional().nullable(),
      esDefault: z.boolean().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const userId = context.userId;
    const payload: any = {
      bodega_id: data.bodegaId,
      codigo: data.codigo,
      nombre: data.nombre,
      tipo: data.tipo,
      categoria_producto: data.categoriaProducto ?? null,
      producto_id: data.productoId ?? null,
      descripcion: data.descripcion ?? null,
      activo: data.activo,
      version: data.version,
      fecha_vigencia: data.fechaVigencia ?? null,
      es_default: data.esDefault,
    };
    if (data.esDefault) {
      await supabase
        .from("procesos_documentales")
        .update({ es_default: false })
        .eq("bodega_id", data.bodegaId)
        .eq("tipo", data.tipo);
    }
    if (data.id) {
      const { data: row, error } = await supabase
        .from("procesos_documentales")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    payload.created_by = userId;
    const { data: row, error } = await supabase
      .from("procesos_documentales")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProcesoDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { error } = await supabase
      .from("procesos_documentales")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
