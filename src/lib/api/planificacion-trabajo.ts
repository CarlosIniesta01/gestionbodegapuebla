import { calcularDosificacion } from "@/lib/dosificacion";
import { plantillaParaOperacion, validarPlanificacion, validarRelacionesPlan, type ContextoPlanificacion, type PlanificacionGuardada } from "@/lib/plantillas-trabajo";

export async function obtenerContextoPlanificacion(supabase: any, bodegaId: string): Promise<ContextoPlanificacion> {
  const resultados = await Promise.all([
    supabase.from("bodega_maps").select("data").eq("bodega_id", bodegaId).maybeSingle(),
    supabase.from("existencias_actuales").select("*").eq("bodega_id", bodegaId),
    supabase.from("productos_comerciales").select("id,nombre").eq("bodega_id", bodegaId),
    supabase.from("productos").select("id,nombre,tipo,unidad").eq("bodega_id", bodegaId).eq("activo", true),
    supabase.from("producto_lotes").select("id,producto_id,numero_lote,estado,fecha_caducidad").eq("bodega_id", bodegaId),
    supabase.from("analiticas_lote").select("id,deposito_id,lote_id,parametro,valor,valor_texto,unidad,fecha").eq("bodega_id", bodegaId).order("fecha", { ascending: false }),
  ]);
  for (const r of resultados) if (r.error) throw new Error(r.error.message);
  const [map, exist, comerciales, productos, lotes, analiticas] = resultados;
  const nombres = new Map((comerciales.data ?? []).map((p: any) => [p.id, p.nombre]));
  return {
    depositos: (map.data?.data?.depositos ?? []).map((d: any) => {
      const contenidos = (exist.data ?? []).filter((e: any) => e.deposito_id === d.id && Number(e.litros) > 0).map((e: any) => ({
        producto_id: e.producto_id, nombre: String(nombres.get(e.producto_id) ?? "Producto sin nombre disponible"),
        litros: Number(e.litros), grado: e.grado_medio === null ? null : Number(e.grado_medio),
      }));
      return { id: String(d.id), codigo: String(d.codigo), capacidad: Number(d.capacidad ?? 0), litros: contenidos.reduce((n: number, e: any) => n + e.litros, 0), contenidos };
    }),
    productos: productos.data ?? [], lotes: lotes.data ?? [], analiticas: analiticas.data ?? [],
  };
}

export async function prepararPlanificacion(supabase: any, bodegaId: string, operacionId: string | undefined, input: unknown, origen?: string, destino?: string): Promise<PlanificacionGuardada | null> {
  if (input === undefined) return null;
  if (!operacionId) throw new Error("La planificación requiere una operación del catálogo");
  const { data: op, error } = await supabase.from("operaciones_catalogo").select("codigo,tipo_formulario").eq("id", operacionId).maybeSingle();
  if (error) throw new Error(error.message);
  const plantilla = plantillaParaOperacion(op);
  if (!plantilla) throw new Error("Esta operación no dispone de esta plantilla");
  const plan = validarPlanificacion(input, plantilla);
  const contexto = await obtenerContextoPlanificacion(supabase, bodegaId);
  validarRelacionesPlan(plan, contexto, origen, destino);
  return { ...plan, productos: plan.productos.map((p) => ({
    ...p, cantidad_prevista: calcularDosificacion(plan.litros_previstos, p.dosis, p.unidad_dosis, p.unidad_cantidad, p.densidad_kg_l),
    producto_nombre: contexto.productos.find((r) => r.id === p.producto_id)?.nombre ?? "",
    lote_numero: contexto.lotes.find((l) => l.id === p.lote_id)?.numero_lote ?? null,
  })) };
}