import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Catálogo maestro de operaciones (Bloque A). Solo describe capacidades:
// nada aquí crea movimientos, consumos ni toca existencias.

const TIPOS_FORM = ["operacion","trasiego","vendimia","producto","limpieza","embotellado","carga","descarga","incidencia","observacion"] as const;

async function perm(supabase: any, bodegaId: string, key: string) {
  const { data, error } = await supabase.rpc("has_permission", { _bodega: bodegaId, _perm: key });
  if (error) throw new Error(error.message);
  return !!data;
}
// Filas globales (bodega_id NULL) solo las gestiona quien tenga operaciones.catalogo.global
// (Administrador / Enólogo). Las filas propias de un centro usan el permiso del centro.
async function requireRowPerm(supabase: any, tabla: string, id: string, bodegaId: string, key: string) {
  const { data: row, error } = await supabase.from(tabla).select("bodega_id").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (row.bodega_id === null) {
    const { data: ok } = await supabase.rpc("has_permission_any", { _perm: "operaciones.catalogo.global" });
    if (!ok) throw new Error("Solo Administración o Enología pueden modificar el catálogo maestro global");
  } else {
    if (row.bodega_id !== bodegaId) throw new Error("La operación pertenece a otro centro");
    await requirePerm(supabase, bodegaId, key);
  }
}
async function requirePerm(supabase: any, bodegaId: string, key: string) {
  if (!(await perm(supabase, bodegaId, key))) throw new Error(`Permiso denegado: ${key}`);
}

export const getCatalogoOperaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaIds: z.array(z.string().uuid()).min(1).max(50) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [fam, ops, cfg] = await Promise.all([
      supabase.from("familias_operativas").select("*").order("orden"),
      supabase.from("operaciones_catalogo").select("*").order("orden"),
      supabase.from("centro_operaciones").select("bodega_id,operacion_id,habilitada").in("bodega_id", data.bodegaIds),
    ]);
    for (const r of [fam, ops, cfg]) if (r.error) throw new Error(r.error.message);
    const permisos: Record<string, Record<string, boolean>> = {};
    for (const b of data.bodegaIds) {
      const keys = ["operaciones.catalogo.create","operaciones.catalogo.edit","operaciones.catalogo.disable","operaciones.centros.configure","operaciones.catalogo.global"];
      const vals = await Promise.all(keys.map((k) => perm(supabase, b, k)));
      permisos[b] = Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
    }
    return { familias: fam.data ?? [], operaciones: ops.data ?? [], centro: cfg.data ?? [], permisos };
  });

export const guardarFamilia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    codigo: z.string().trim().min(1).max(20),
    nombre: z.string().trim().min(1).max(120),
    descripcion: z.string().max(1000).nullable().optional(),
    icono: z.string().max(40).default("Layers"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#475569"),
    orden: z.number().int().min(0).max(100000).default(0),
    global: z.boolean().default(false),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { bodegaId, id, global, ...rest } = data;
    if (id) {
      await requireRowPerm(supabase, "familias_operativas", id, bodegaId, "operaciones.catalogo.edit");
      const { data: row, error } = await supabase.from("familias_operativas").update(rest).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    if (global) {
      const { data: ok } = await supabase.rpc("has_permission_any", { _perm: "operaciones.catalogo.global" });
      if (!ok) throw new Error("Solo Administración o Enología pueden crear elementos globales");
    } else await requirePerm(supabase, bodegaId, "operaciones.catalogo.create");
    const { data: row, error } = await supabase.from("familias_operativas")
      .insert({ ...rest, bodega_id: global ? null : bodegaId, created_by: userId }).select("*").single();
    if (error) throw new Error(error.code === "23505" ? "Ya existe una familia con ese código" : error.message);
    return row;
  });

const OpSchema = z.object({
  bodegaId: z.string().uuid(),
  id: z.string().uuid().optional(),
  familia_id: z.string().uuid(),
  codigo: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(1).max(160),
  descripcion: z.string().max(1000).nullable().optional(),
  orden: z.number().int().min(0).max(100000).default(0),
  tipo_formulario: z.enum(TIPOS_FORM).default("operacion"),
  requiere_deposito_origen: z.boolean().default(false),
  requiere_deposito_destino: z.boolean().default(false),
  requiere_producto: z.boolean().default(false),
  requiere_lote: z.boolean().default(false),
  requiere_operarios: z.boolean().default(true),
  requiere_laboratorio: z.boolean().default(false),
  admite_productos_enologicos: z.boolean().default(false),
  admite_consumos: z.boolean().default(false),
  admite_movimientos: z.boolean().default(false),
  admite_ejecucion_parcial: z.boolean().default(false),
  requiere_autorizacion: z.boolean().default(false),
  global: z.boolean().default(false),
});

export const guardarOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OpSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { bodegaId, id, global, ...rest } = data;
    if (id) {
      await requireRowPerm(supabase, "operaciones_catalogo", id, bodegaId, "operaciones.catalogo.edit");
      const { data: row, error } = await supabase.from("operaciones_catalogo").update(rest).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    if (global) {
      const { data: ok } = await supabase.rpc("has_permission_any", { _perm: "operaciones.catalogo.global" });
      if (!ok) throw new Error("Solo Administración o Enología pueden crear elementos globales");
    } else await requirePerm(supabase, bodegaId, "operaciones.catalogo.create");
    const { data: row, error } = await supabase.from("operaciones_catalogo")
      .insert({ ...rest, bodega_id: global ? null : bodegaId, created_by: userId }).select("*").single();
    if (error) throw new Error(error.code === "23505" ? "Ya existe una operación con ese código" : error.message);
    return row;
  });

export const setActivoCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    tabla: z.enum(["familia", "operacion"]),
    id: z.string().uuid(),
    activo: z.boolean(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const t = data.tabla === "familia" ? "familias_operativas" : "operaciones_catalogo";
    await requireRowPerm(supabase, t, data.id, data.bodegaId, "operaciones.catalogo.disable");
    const { error } = await supabase.from(t).update({ activo: data.activo }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOperacionCentro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    operacionIds: z.array(z.string().uuid()).min(1).max(500),
    habilitada: z.boolean(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePerm(supabase, data.bodegaId, "operaciones.centros.configure");
    const rows = data.operacionIds.map((operacion_id) => ({
      bodega_id: data.bodegaId, operacion_id, habilitada: data.habilitada, updated_by: userId,
    }));
    const { error } = await supabase.from("centro_operaciones").upsert(rows, { onConflict: "bodega_id,operacion_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
