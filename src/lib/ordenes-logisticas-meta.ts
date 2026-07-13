export type OrdenTipo = "carga" | "descarga";

export type OrdenEstado =
  | "borrador"
  | "programada"
  | "pendiente_laboratorio"
  | "autorizada"
  | "en_proceso"
  | "pendiente_confirmacion"
  | "completada"
  | "cerrada"
  | "rechazada"
  | "cancelada"
  | "rectificada";

export const ORDEN_ESTADOS: { id: OrdenEstado; label: string; tone: string }[] = [
  { id: "borrador", label: "Borrador", tone: "bg-muted text-muted-foreground border-border" },
  { id: "programada", label: "Programada", tone: "bg-state-trasiego/15 text-state-trasiego border-state-trasiego/40" },
  { id: "pendiente_laboratorio", label: "Pdte. laboratorio", tone: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  { id: "autorizada", label: "Autorizada", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  { id: "en_proceso", label: "En proceso", tone: "bg-emerald-600/25 text-emerald-100 border-emerald-500/50" },
  { id: "pendiente_confirmacion", label: "Pdte. confirmación", tone: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  { id: "completada", label: "Completada", tone: "bg-emerald-700/30 text-emerald-100 border-emerald-600/60" },
  { id: "cerrada", label: "Cerrada", tone: "bg-muted text-foreground border-border" },
  { id: "rechazada", label: "Rechazada", tone: "bg-state-incidencia/15 text-state-incidencia border-state-incidencia/40" },
  { id: "cancelada", label: "Cancelada", tone: "bg-state-incidencia/15 text-state-incidencia border-state-incidencia/40" },
  { id: "rectificada", label: "Rectificada", tone: "bg-violet-500/15 text-violet-300 border-violet-500/40" },
];

export const ESTADO_META: Record<OrdenEstado, { label: string; tone: string }> =
  Object.fromEntries(ORDEN_ESTADOS.map((e) => [e.id, e])) as any;

export type ValidationError = {
  code: string;
  bloque: "generales" | "deposito" | "producto" | "compartimentos" | "laboratorio" | "operarios" | "transporte" | "contrato" | "otros";
  message: string;
  critico: boolean;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  resumen: Record<string, any>;
};

export const COMPROBACIONES_CARGA_DEFAULT: { key: string; label: string }[] = [
  { key: "certificado_lavado", label: "Certificado de lavado solicitado al conductor" },
  { key: "cisterna", label: "Cisterna / envase comprobado" },
  { key: "compartimentos", label: "Compartimentos comprobados" },
  { key: "colectores", label: "Colectores comprobados" },
  { key: "grifos", label: "Grifos y accesos comprobados" },
  { key: "apta_carga", label: "Cisterna / envase apta para la carga" },
  { key: "filtro_inox", label: "Filtro de acero inoxidable preparado y comprobado" },
  { key: "sin_objetos", label: "Ausencia de objetos extraños o incidencias visibles" },
];

export const PARAMETROS_DESCARGA_DEFAULT: { parametro: string; unidad: string; obligatorio: boolean }[] = [
  { parametro: "Grado alcohólico", unidad: "% vol", obligatorio: true },
  { parametro: "Acidez total", unidad: "g/L", obligatorio: true },
  { parametro: "Acidez volátil", unidad: "g/L", obligatorio: true },
  { parametro: "Organoléptica", unidad: "", obligatorio: true },
];

export const DECLARACION_TRANSPORTISTA_TEXTO =
  "EL TRANSPORTISTA DECLARA QUE TODOS LOS ACCESOS A LA MERCANCÍA HAN QUEDADO INDICADOS PARA SU CORRECTO PRECINTADO Y QUE RECIBE TODA LA DOCUMENTACIÓN EXIGIDA POR EL CLIENTE PARA SU ENTREGA EN DESTINO.";
