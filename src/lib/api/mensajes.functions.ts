import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CanalEnum = z.enum(["general", "deposito", "trabajo"]);

export const listMensajes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    canal: CanalEnum,
    canalRef: z.string().max(120).nullable().optional(),
    limit: z.number().min(1).max(200).default(100),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("mensajes")
      .select("id, bodega_id, canal, canal_ref, user_id, contenido, created_at, autor:profiles!mensajes_user_id_fkey(user_id,nombre,avatar_url)")
      .eq("bodega_id", data.bodegaId)
      .eq("canal", data.canal)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (data.canalRef) q = q.eq("canal_ref", data.canalRef);
    else q = q.is("canal_ref", null);
    const { data: rows, error } = await q;
    if (error) {
      // fallback without join
      let q2 = supabase
        .from("mensajes").select("*")
        .eq("bodega_id", data.bodegaId)
        .eq("canal", data.canal)
        .order("created_at", { ascending: true })
        .limit(data.limit);
      if (data.canalRef) q2 = q2.eq("canal_ref", data.canalRef);
      else q2 = q2.is("canal_ref", null);
      const { data: rows2, error: err2 } = await q2;
      if (err2) throw new Error(err2.message);
      return rows2 ?? [];
    }
    return rows ?? [];
  });

export const sendMensaje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    canal: CanalEnum,
    canalRef: z.string().max(120).nullable().optional(),
    contenido: z.string().min(1).max(2000),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("mensajes").insert({
      bodega_id: data.bodegaId,
      canal: data.canal,
      canal_ref: data.canalRef ?? null,
      user_id: userId,
      contenido: data.contenido,
    } as any).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMensaje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("mensajes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
