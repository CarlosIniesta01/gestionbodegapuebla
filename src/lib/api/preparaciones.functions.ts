import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VinoSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  cantidad: z.number().nullable().optional(),
  unidad: z.enum(["L", "%", "kg", "hl"]).default("L"),
  notas: z.string().max(300).optional().nullable(),
});

const ProductoSchema = z.object({
  producto: z.string().trim().min(1).max(200),
  dosis: z.number().nullable().optional(),
  unidad: z.string().max(20).optional().nullable(),
  lote: z.string().max(100).optional().nullable(),
});

const Base = z.object({
  bodegaId: z.string().uuid(),
  nombre: z.string().trim().min(1).max(200),
  descripcion: z.string().max(2000).optional().nullable(),
  vinos: z.array(VinoSchema).default([]),
  productos: z.array(ProductoSchema).default([]),
  notas: z.string().max(2000).optional().nullable(),
});

export const listPreparaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("preparaciones")
      .select("*")
      .eq("bodega_id", data.bodegaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPreparacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(Base.extend({ id: z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      bodega_id: data.bodegaId,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      vinos: data.vinos,
      productos: data.productos,
      notas: data.notas ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("preparaciones").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("preparaciones")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deletePreparacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("preparaciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
