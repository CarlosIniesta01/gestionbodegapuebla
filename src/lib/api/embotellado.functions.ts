import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AsignadoSchema = z.object({
  user_id: z.string().uuid(),
  rol: z.string().default("operario"),
});

async function setAsignados(supabase: any, trabajoId: string, asignados: Array<{ user_id: string; rol: string }>) {
  if (!asignados.length) return;
  await supabase.from("trabajo_asignados").delete().eq("trabajo_id", trabajoId);
  await supabase.from("trabajo_asignados").insert(
    asignados.map((a) => ({ trabajo_id: trabajoId, user_id: a.user_id, rol: a.rol })),
  );
}

// ============ Embotellado directo ============
export const crearEmbotelladoDirecto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    deposito: z.string().min(1),
    zona: z.string().optional(),
    litros: z.number().positive(),
    formato: z.string().optional(),
    botellas: z.number().int().positive().optional(),
    lote: z.string().min(1, "Lote obligatorio").max(120),
    observaciones: z.string().max(2000).optional(),
    scheduledAt: z.string().datetime().optional(),
    asignados: z.array(AsignadoSchema).default([]),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const titulo = `Embotellado ${data.deposito} · ${data.lote}`;
    const datos: any = {
      modo: "directo",
      litros: data.litros,
      formato: data.formato ?? null,
      botellas: data.botellas ?? null,
      lote: data.lote,
    };
    const { data: trabajo, error } = await supabase
      .from("trabajos")
      .insert({
        bodega_id: data.bodegaId,
        tipo: "embotellado",
        titulo,
        descripcion: data.observaciones ?? null,
        estado: "pendiente",
        prioridad: "normal",
        deposito_origen: data.deposito,
        scheduled_at: data.scheduledAt ?? null,
        datos,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw new Error(error.message);

    await setAsignados(supabase, trabajo.id, data.asignados);
    await supabase.from("trabajo_eventos").insert({
      trabajo_id: trabajo.id,
      user_id: userId,
      tipo: "creado",
      contenido: `Embotellado desde ${data.deposito} · ${data.litros} L · lote ${data.lote}`,
      meta: datos,
    });
    return trabajo;
  });

// ============ Elaboración propia ============
export const crearElaboracionPropia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    nombre: z.string().min(1).max(200),
    fecha: z.string().datetime().optional(),
    lote_embotellado: z.string().min(1, "Lote obligatorio").max(120),
    observaciones: z.string().max(2000).optional(),
    scheduledAt: z.string().datetime().optional(),
    asignados: z.array(AsignadoSchema).default([]),
    depositos: z.array(z.object({
      deposito_codigo: z.string().min(1),
      zona: z.string().optional(),
      litros: z.number().positive(),
      variedad: z.string().optional(),
    })).min(1, "Añade al menos un depósito"),
    productos: z.array(z.object({
      producto_id: z.string().uuid(),
      lote: z.string().min(1, "Debes indicar el lote del producto para continuar."),
      cantidad: z.number().positive(),
      unidad: z.string().default("g"),
      observaciones: z.string().optional(),
    })).default([]),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Validación lote producto
    for (const p of data.productos) {
      if (!p.lote || !p.lote.trim()) {
        throw new Error("Debes indicar el lote del producto para continuar.");
      }
    }
    const totalLitros = data.depositos.reduce((s, d) => s + d.litros, 0);
    const titulo = `Elaboración · ${data.nombre} · ${data.lote_embotellado}`;
    const datos = {
      modo: "elaboracion",
      nombre: data.nombre,
      lote: data.lote_embotellado,
      total_litros: totalLitros,
      n_depositos: data.depositos.length,
      n_productos: data.productos.length,
    };
    const { data: trabajo, error } = await supabase
      .from("trabajos")
      .insert({
        bodega_id: data.bodegaId,
        tipo: "embotellado",
        titulo,
        descripcion: data.observaciones ?? null,
        estado: "pendiente",
        prioridad: "normal",
        scheduled_at: data.scheduledAt ?? null,
        datos,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw new Error(error.message);

    const { data: elab, error: e2 } = await supabase
      .from("elaboraciones").insert({
        bodega_id: data.bodegaId,
        trabajo_id: trabajo.id,
        nombre: data.nombre,
        fecha: data.fecha ?? new Date().toISOString(),
        lote_embotellado: data.lote_embotellado,
        observaciones: data.observaciones ?? null,
        created_by: userId,
      }).select("*").single();
    if (e2) throw new Error(e2.message);

    if (data.depositos.length) {
      const { error: e3 } = await supabase.from("elaboracion_depositos").insert(
        data.depositos.map((d) => ({
          elaboracion_id: elab.id,
          deposito_codigo: d.deposito_codigo,
          zona: d.zona ?? null,
          litros: d.litros,
          variedad: d.variedad ?? null,
        })),
      );
      if (e3) throw new Error(e3.message);
    }
    if (data.productos.length) {
      const { error: e4 } = await supabase.from("elaboracion_productos").insert(
        data.productos.map((p) => ({
          elaboracion_id: elab.id,
          producto_id: p.producto_id,
          lote: p.lote,
          cantidad: p.cantidad,
          unidad: p.unidad,
          observaciones: p.observaciones ?? null,
        })),
      );
      if (e4) throw new Error(e4.message);
    }

    await setAsignados(supabase, trabajo.id, data.asignados);
    await supabase.from("trabajo_eventos").insert({
      trabajo_id: trabajo.id,
      user_id: userId,
      tipo: "creado",
      contenido: `Elaboración "${data.nombre}" · ${totalLitros} L de ${data.depositos.length} depósito(s) · ${data.productos.length} producto(s) · lote ${data.lote_embotellado}`,
      meta: datos,
    });
    return { trabajo, elaboracion: elab };
  });
