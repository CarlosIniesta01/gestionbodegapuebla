import {
  Grape, PackageOpen, Wine, FlaskRound, Droplets, Blend, Filter, Funnel, Warehouse, FlaskConical,
  Truck, Package, Sparkles, Wrench, Recycle, ShieldCheck, Settings2, Layers, type LucideIcon,
} from "lucide-react";

export const ICONOS_FAMILIA: Record<string, LucideIcon> = {
  Grape, PackageOpen, Wine, FlaskRound, Droplets, Blend, Filter, Funnel, Warehouse, FlaskConical,
  Truck, Package, Sparkles, Wrench, Recycle, ShieldCheck, Settings2, Layers,
};
export const iconoFamilia = (k?: string | null): LucideIcon => (k && ICONOS_FAMILIA[k]) || Layers;

export type Familia = {
  id: string; bodega_id: string | null; codigo: string; nombre: string; descripcion: string | null;
  icono: string; color: string; orden: number; activo: boolean;
};
export type Operacion = {
  id: string; familia_id: string; bodega_id: string | null; codigo: string; nombre: string;
  descripcion: string | null; activo: boolean; orden: number; tipo_formulario: string;
  requiere_deposito_origen: boolean; requiere_deposito_destino: boolean; requiere_producto: boolean;
  requiere_lote: boolean; requiere_operarios: boolean; requiere_laboratorio: boolean;
  admite_productos_enologicos: boolean; admite_consumos: boolean; admite_movimientos: boolean;
  admite_ejecucion_parcial: boolean; requiere_autorizacion: boolean;
};
export type CentroCfg = { bodega_id: string; operacion_id: string; habilitada: boolean };

export const CAPACIDADES: { key: keyof Operacion; label: string }[] = [
  { key: "requiere_deposito_origen", label: "Depósito origen" },
  { key: "requiere_deposito_destino", label: "Depósito destino" },
  { key: "requiere_producto", label: "Producto" },
  { key: "requiere_lote", label: "Lote" },
  { key: "requiere_operarios", label: "Operarios" },
  { key: "requiere_laboratorio", label: "Laboratorio" },
  { key: "admite_productos_enologicos", label: "Productos enológicos" },
  { key: "admite_consumos", label: "Consumos" },
  { key: "admite_movimientos", label: "Movimientos" },
  { key: "admite_ejecucion_parcial", label: "Ejecución parcial" },
  { key: "requiere_autorizacion", label: "Autorización" },
];

export const TIPO_FORMULARIO_LABEL: Record<string, string> = {
  operacion: "Orden genérica", trasiego: "Trasiego", vendimia: "Vendimia", producto: "Producto enológico",
  limpieza: "Limpieza", embotellado: "Embotellado", carga: "Orden de carga", descarga: "Orden de descarga",
  incidencia: "Incidencia", observacion: "Observación",
  traslado_intercentros: "Traslado entre centros",
};

/** Operaciones sin formulario propio todavía: no se pueden guardar como otro tipo. */
export const TIPOS_PENDIENTES_CONFIG = new Set(["traslado_intercentros"]);

/** Sin fila de configuración = habilitada por defecto. */
export function habilitadaEnCentro(cfg: CentroCfg[], bodegaId: string, opId: string) {
  const r = cfg.find((c) => c.bodega_id === bodegaId && c.operacion_id === opId);
  return r ? r.habilitada : true;
}

/** Operaciones seleccionables al crear un trabajo en un centro. */
export function operacionesDisponibles(
  fams: Familia[], ops: Operacion[], cfg: CentroCfg[], bodegaId: string,
) {
  const famActiva = new Set(fams.filter((f) => f.activo && (!f.bodega_id || f.bodega_id === bodegaId)).map((f) => f.id));
  return ops
    .filter((o) => o.activo && famActiva.has(o.familia_id) && (!o.bodega_id || o.bodega_id === bodegaId))
    .filter((o) => habilitadaEnCentro(cfg, bodegaId, o.id))
    .sort((a, b) => a.orden - b.orden);
}
