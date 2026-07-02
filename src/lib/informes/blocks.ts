// Catálogo de bloques del motor de informes.
// Cada bloque tiene id estable, categoría, label y flags de sensibilidad/rol.
// La UI del constructor y el renderer se apoyan exclusivamente en este catálogo.

export type BlockCategory =
  | "info"
  | "procesos"
  | "productos"
  | "operarios"
  | "analiticas"
  | "auditoria"
  | "trazabilidad"
  | "sensibles"
  | "visuales";

export type BlockDef = {
  id: string;
  label: string;
  category: BlockCategory;
  /** Si es sensible, respeta el toggle de datos sensibles / rol operario. */
  sensible?: boolean;
  /** Si requiere rol específico para verse. */
  requiresRole?: Array<"admin" | "responsable" | "enologo">;
};

export const CATEGORIES: { key: BlockCategory; label: string }[] = [
  { key: "info", label: "Información general" },
  { key: "procesos", label: "Procesos" },
  { key: "productos", label: "Productos enológicos" },
  { key: "operarios", label: "Operarios" },
  { key: "analiticas", label: "Analíticas" },
  { key: "auditoria", label: "Auditoría" },
  { key: "trazabilidad", label: "Trazabilidad" },
  { key: "sensibles", label: "Datos sensibles" },
  { key: "visuales", label: "Elementos visuales" },
];

export const BLOCKS: BlockDef[] = [
  // Información general
  { id: "info.portada", label: "Portada", category: "info" },
  { id: "info.datos_lote", label: "Datos del lote", category: "info" },
  { id: "info.campana", label: "Campaña", category: "info" },
  { id: "info.centro", label: "Centro", category: "info" },
  { id: "info.producto", label: "Producto", category: "info" },
  { id: "info.tipo", label: "Tipo", category: "info" },
  { id: "info.estado", label: "Estado", category: "info" },
  { id: "info.deposito_inicial", label: "Depósito inicial", category: "info" },
  { id: "info.deposito_actual", label: "Depósito actual", category: "info" },
  { id: "info.volumen_inicial", label: "Volumen inicial", category: "info" },
  { id: "info.volumen_actual", label: "Volumen actual", category: "info" },
  { id: "info.responsable", label: "Responsable", category: "info" },

  // Procesos
  { id: "procesos.recepcion", label: "Recepción", category: "procesos" },
  { id: "procesos.limpiezas", label: "Limpiezas", category: "procesos" },
  { id: "procesos.sulfitado", label: "Sulfitado", category: "procesos" },
  { id: "procesos.fermentacion", label: "Fermentación", category: "procesos" },
  { id: "procesos.trasiegos", label: "Trasiegos", category: "procesos" },
  { id: "procesos.mezclas", label: "Mezclas", category: "procesos" },
  { id: "procesos.correcciones", label: "Correcciones", category: "procesos" },
  { id: "procesos.clarificaciones", label: "Clarificaciones", category: "procesos" },
  { id: "procesos.filtraciones", label: "Filtraciones", category: "procesos" },
  { id: "procesos.estabilizacion", label: "Estabilización", category: "procesos" },
  { id: "procesos.embotellado", label: "Embotellado", category: "procesos" },
  { id: "procesos.almacenamiento", label: "Almacenamiento", category: "procesos" },
  { id: "procesos.expedicion", label: "Expedición", category: "procesos" },
  { id: "procesos.incidencias", label: "Incidencias", category: "procesos" },
  { id: "procesos.mantenimientos", label: "Mantenimientos", category: "procesos" },

  // Productos enológicos
  { id: "productos.utilizados", label: "Productos utilizados", category: "productos" },
  { id: "productos.funcion", label: "Función", category: "productos" },
  { id: "productos.categoria", label: "Categoría", category: "productos" },
  { id: "productos.cantidades", label: "Cantidades", category: "productos" },
  { id: "productos.lotes", label: "Lotes", category: "productos", sensible: true },
  { id: "productos.caducidad", label: "Caducidad", category: "productos" },
  { id: "productos.proveedor", label: "Proveedor", category: "productos", sensible: true },
  { id: "productos.marca", label: "Marca comercial", category: "productos", sensible: true },
  { id: "productos.costes", label: "Costes", category: "productos", sensible: true, requiresRole: ["admin", "responsable"] },
  { id: "productos.autorizaciones", label: "Autorizaciones de uso", category: "productos" },

  // Operarios
  { id: "operarios.lista", label: "Operarios", category: "operarios", sensible: true },
  { id: "operarios.responsable", label: "Responsable", category: "operarios" },
  { id: "operarios.horas", label: "Horas", category: "operarios", sensible: true },
  { id: "operarios.fechas", label: "Fechas", category: "operarios" },
  { id: "operarios.observaciones", label: "Observaciones", category: "operarios", sensible: true },
  { id: "operarios.firma", label: "Firma", category: "operarios" },

  // Analíticas
  { id: "analiticas.mostrar", label: "Analíticas", category: "analiticas" },
  { id: "analiticas.evolucion", label: "Evolución", category: "analiticas" },
  { id: "analiticas.parametros", label: "Parámetros", category: "analiticas" },
  { id: "analiticas.graficos", label: "Gráficos", category: "analiticas" },
  { id: "analiticas.observaciones", label: "Observaciones", category: "analiticas" },

  // Auditoría
  { id: "auditoria.historial", label: "Historial", category: "auditoria", requiresRole: ["admin", "responsable"] },
  { id: "auditoria.usuarios", label: "Usuarios", category: "auditoria", requiresRole: ["admin", "responsable"] },
  { id: "auditoria.cambios", label: "Cambios", category: "auditoria", requiresRole: ["admin", "responsable"] },
  { id: "auditoria.evidencias", label: "Evidencias", category: "auditoria", requiresRole: ["admin", "responsable"] },
  { id: "auditoria.fechas", label: "Fechas", category: "auditoria" },

  // Trazabilidad
  { id: "traza.linea_temporal", label: "Línea temporal", category: "trazabilidad" },
  { id: "traza.arbol", label: "Árbol de procesos", category: "trazabilidad" },
  { id: "traza.movimientos", label: "Movimientos", category: "trazabilidad" },
  { id: "traza.trabajos", label: "Trabajos", category: "trazabilidad" },
  { id: "traza.contratos", label: "Contratos relacionados", category: "trazabilidad", sensible: true },
  { id: "traza.productos", label: "Productos utilizados", category: "trazabilidad" },
  { id: "traza.lotes", label: "Lotes utilizados", category: "trazabilidad" },
  { id: "traza.caducidades", label: "Caducidades", category: "trazabilidad" },
  { id: "traza.depositos", label: "Depósitos", category: "trazabilidad" },

  // Datos sensibles (toggles inversos: si están activos, ocultan)
  { id: "hide.proveedores", label: "Ocultar proveedores", category: "sensibles" },
  { id: "hide.marcas", label: "Ocultar marcas comerciales", category: "sensibles" },
  { id: "hide.lotes", label: "Ocultar lotes de productos", category: "sensibles" },
  { id: "hide.costes", label: "Ocultar costes", category: "sensibles" },
  { id: "hide.protocolos", label: "Ocultar protocolos internos", category: "sensibles" },
  { id: "hide.observaciones", label: "Ocultar observaciones privadas", category: "sensibles" },
  { id: "hide.operarios", label: "Ocultar operarios", category: "sensibles" },
  { id: "hide.analiticas", label: "Ocultar analíticas", category: "sensibles" },
  { id: "hide.anonimizar", label: "Anonimizar usuarios", category: "sensibles" },

  // Visuales
  { id: "vis.logo", label: "Logo", category: "visuales" },
  { id: "vis.qr", label: "Código QR", category: "visuales" },
  { id: "vis.firmas", label: "Firmas", category: "visuales" },
  { id: "vis.sellos", label: "Sellos", category: "visuales" },
  { id: "vis.certificados", label: "Certificados", category: "visuales" },
  { id: "vis.numeracion", label: "Numeración", category: "visuales" },
  { id: "vis.indice", label: "Índice", category: "visuales" },
  { id: "vis.pie", label: "Pie de página", category: "visuales" },
];

export const BLOCK_BY_ID: Record<string, BlockDef> = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));

export function isBlockEnabled(cfg: Record<string, boolean>, id: string) {
  return !!cfg[id];
}

export function hasRoleForBlock(block: BlockDef, roleKey?: string): boolean {
  if (!block.requiresRole || block.requiresRole.length === 0) return true;
  if (!roleKey) return false;
  return (block.requiresRole as string[]).includes(roleKey);
}
