import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ZonaSchema = z.object({
  id: z.string().min(1).max(80),
  nombre: z.string().min(1).max(120),
  corto: z.string().min(1).max(12),
  color: z.string().min(1).max(40),
  pos_x: z.number().finite(),
  pos_y: z.number().finite(),
  ancho: z.number().finite().positive(),
  alto: z.number().finite().positive(),
}).passthrough();

const DepositoSchema = z.object({
  id: z.string().min(1).max(80),
  zona_id: z.string().min(1).max(80),
  codigo: z.string().min(1).max(60),
  capacidad: z.number().finite().min(0),
  litros: z.number().finite().min(0),
  contenido: z.string().max(200).nullable().optional(),
  estado: z.string().min(1).max(60),
  pos_x: z.number().finite(),
  pos_y: z.number().finite(),
  radio: z.number().finite().min(8).max(80),
  ultimoMovimiento: z.string().max(120).nullable().optional(),
}).passthrough();

const MapDataSchema = z.object({
  zonas: z.array(ZonaSchema).max(500),
  depositos: z.array(DepositoSchema).max(5000),
});

async function assertMember(supabase: any, userId: string, bodegaId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No tienes acceso a esta bodega");
}

async function assertAdmin(supabase: any, userId: string, bodegaId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, roles!inner(key)")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data as any).roles?.key !== "admin") {
    throw new Error("Solo un administrador puede guardar cambios en el mapa de la bodega");
  }
}

export const getBodegaMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.bodegaId);

    const { data: row, error } = await (supabase as any)
      .from("bodega_maps")
      .select("data")
      .eq("bodega_id", data.bodegaId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return row?.data ? MapDataSchema.parse(row.data) : null;
  });

export const saveBodegaMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    map: MapDataSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);

    const { error } = await (supabase as any)
      .from("bodega_maps")
      .upsert({
        bodega_id: data.bodegaId,
        data: data.map,
        updated_by: userId,
      }, { onConflict: "bodega_id" });
    if (error) throw new Error(error.message);

    return { ok: true };
  });