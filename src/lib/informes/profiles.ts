import { BLOCKS } from "./blocks";

export type InformeConfig = Record<string, boolean>;

export type Profile = {
  id: string;
  label: string;
  description?: string;
  builtin?: boolean;
  config: InformeConfig;
};

function makeConfig(enabledIds: string[]): InformeConfig {
  const cfg: InformeConfig = {};
  for (const b of BLOCKS) cfg[b.id] = enabledIds.includes(b.id);
  return cfg;
}

const CORE_INFO = [
  "info.portada", "info.datos_lote", "info.campana", "info.centro",
  "info.producto", "info.tipo", "info.estado",
  "info.deposito_inicial", "info.deposito_actual",
  "info.volumen_inicial", "info.volumen_actual", "info.responsable",
];

const CORE_TRAZA = [
  "traza.linea_temporal", "traza.movimientos", "traza.trabajos",
  "traza.productos", "traza.lotes", "traza.caducidades", "traza.depositos",
];

const CORE_VISUAL = ["vis.logo", "vis.numeracion", "vis.indice", "vis.pie"];

export const BUILTIN_PROFILES: Profile[] = [
  {
    id: "interno", label: "Informe interno", builtin: true,
    description: "Vista completa para uso interno de bodega.",
    config: makeConfig([
      ...CORE_INFO,
      "procesos.recepcion", "procesos.fermentacion", "procesos.trasiegos",
      "procesos.correcciones", "procesos.embotellado", "procesos.incidencias",
      "productos.utilizados", "productos.funcion", "productos.categoria",
      "productos.cantidades", "productos.lotes", "productos.caducidad",
      "productos.proveedor", "productos.costes", "productos.autorizaciones",
      "operarios.lista", "operarios.responsable", "operarios.fechas", "operarios.observaciones",
      "analiticas.mostrar", "analiticas.parametros", "analiticas.evolucion", "analiticas.observaciones",
      "auditoria.historial", "auditoria.usuarios", "auditoria.cambios", "auditoria.fechas",
      ...CORE_TRAZA, "traza.contratos",
      ...CORE_VISUAL, "vis.firmas",
    ]),
  },
  {
    id: "cliente", label: "Informe cliente", builtin: true,
    description: "Versión para envío a cliente. Oculta datos sensibles.",
    config: makeConfig([
      ...CORE_INFO,
      "procesos.recepcion", "procesos.fermentacion", "procesos.embotellado",
      "productos.utilizados", "productos.funcion", "productos.categoria", "productos.autorizaciones",
      "operarios.responsable", "operarios.fechas",
      "analiticas.mostrar", "analiticas.parametros",
      "traza.linea_temporal", "traza.productos", "traza.depositos", "traza.caducidades",
      ...CORE_VISUAL, "vis.firmas", "vis.qr", "vis.sellos",
      "hide.proveedores", "hide.marcas", "hide.costes", "hide.protocolos",
      "hide.observaciones", "hide.operarios", "hide.anonimizar",
    ]),
  },
  {
    id: "auditoria", label: "Informe auditoría", builtin: true,
    description: "Vista completa con historial y evidencias.",
    config: makeConfig([
      ...CORE_INFO,
      "procesos.recepcion", "procesos.limpiezas", "procesos.sulfitado",
      "procesos.fermentacion", "procesos.trasiegos", "procesos.mezclas",
      "procesos.correcciones", "procesos.clarificaciones", "procesos.filtraciones",
      "procesos.estabilizacion", "procesos.embotellado", "procesos.almacenamiento",
      "procesos.expedicion", "procesos.incidencias", "procesos.mantenimientos",
      "productos.utilizados", "productos.funcion", "productos.categoria",
      "productos.cantidades", "productos.lotes", "productos.caducidad",
      "productos.proveedor", "productos.marca", "productos.autorizaciones",
      "operarios.lista", "operarios.responsable", "operarios.horas", "operarios.fechas",
      "operarios.observaciones", "operarios.firma",
      "analiticas.mostrar", "analiticas.evolucion", "analiticas.parametros",
      "analiticas.graficos", "analiticas.observaciones",
      "auditoria.historial", "auditoria.usuarios", "auditoria.cambios",
      "auditoria.evidencias", "auditoria.fechas",
      ...CORE_TRAZA, "traza.arbol", "traza.contratos",
      ...CORE_VISUAL, "vis.firmas", "vis.sellos", "vis.certificados", "vis.qr",
    ]),
  },
  {
    id: "iso22000", label: "Informe ISO 22000", builtin: true,
    description: "Perfil orientado a seguridad alimentaria ISO 22000.",
    config: makeConfig([
      ...CORE_INFO, "procesos.recepcion", "procesos.limpiezas", "procesos.sulfitado",
      "procesos.incidencias", "procesos.mantenimientos",
      "productos.utilizados", "productos.lotes", "productos.caducidad", "productos.autorizaciones",
      "operarios.responsable", "operarios.fechas", "operarios.firma",
      "analiticas.mostrar", "analiticas.parametros",
      "auditoria.historial", "auditoria.evidencias", "auditoria.fechas",
      "traza.linea_temporal", "traza.productos", "traza.lotes", "traza.caducidades",
      ...CORE_VISUAL, "vis.firmas", "vis.certificados",
    ]),
  },
  {
    id: "ifs", label: "Informe IFS", builtin: true,
    config: makeConfig([
      ...CORE_INFO, "procesos.recepcion", "procesos.limpiezas", "procesos.incidencias",
      "productos.utilizados", "productos.lotes", "productos.autorizaciones",
      "operarios.responsable", "operarios.firma", "operarios.fechas",
      "auditoria.historial", "auditoria.evidencias",
      ...CORE_TRAZA, ...CORE_VISUAL, "vis.firmas", "vis.sellos",
    ]),
  },
  {
    id: "brcgs", label: "Informe BRCGS", builtin: true,
    config: makeConfig([
      ...CORE_INFO, "procesos.recepcion", "procesos.limpiezas", "procesos.incidencias",
      "productos.utilizados", "productos.lotes", "productos.caducidad", "productos.autorizaciones",
      "operarios.responsable", "operarios.firma",
      "auditoria.historial", "auditoria.evidencias", "auditoria.fechas",
      ...CORE_TRAZA, ...CORE_VISUAL, "vis.firmas", "vis.sellos", "vis.certificados",
    ]),
  },
  {
    id: "appcc", label: "Informe APPCC", builtin: true,
    config: makeConfig([
      ...CORE_INFO, "procesos.recepcion", "procesos.limpiezas", "procesos.sulfitado",
      "procesos.incidencias", "procesos.mantenimientos",
      "productos.utilizados", "productos.autorizaciones",
      "operarios.responsable", "operarios.firma",
      "analiticas.parametros",
      "auditoria.historial", "auditoria.evidencias",
      "traza.linea_temporal", "traza.productos", "traza.depositos",
      ...CORE_VISUAL, "vis.firmas",
    ]),
  },
  {
    id: "direccion", label: "Informe Dirección", builtin: true,
    config: makeConfig([
      ...CORE_INFO,
      "productos.utilizados", "productos.cantidades", "productos.costes",
      "analiticas.mostrar", "analiticas.graficos",
      "traza.movimientos", "traza.contratos",
      ...CORE_VISUAL,
    ]),
  },
  {
    id: "comercial", label: "Informe Comercial", builtin: true,
    config: makeConfig([
      ...CORE_INFO,
      "productos.utilizados", "productos.funcion", "productos.categoria", "productos.autorizaciones",
      "analiticas.mostrar", "analiticas.parametros",
      "traza.linea_temporal", "traza.contratos", "traza.productos", "traza.depositos",
      ...CORE_VISUAL, "vis.qr", "vis.sellos", "vis.certificados",
      "hide.costes", "hide.protocolos", "hide.operarios", "hide.observaciones", "hide.anonimizar",
    ]),
  },
  {
    id: "personalizado", label: "Personalizado", builtin: true,
    description: "Empieza en blanco y activa solo lo que necesites.",
    config: makeConfig([...CORE_INFO, ...CORE_VISUAL]),
  },
];

export function getBuiltinProfile(id: string): Profile | undefined {
  return BUILTIN_PROFILES.find((p) => p.id === id);
}
