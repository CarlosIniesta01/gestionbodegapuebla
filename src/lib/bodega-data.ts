export type DepositoEstado =
  | "vacio"
  | "mosto"
  | "fermentacion"
  | "vino"
  | "limpieza"
  | "trasiego"
  | "incidencia";

export interface Zona {
  id: string;
  nombre: string;
  corto: string;
  color: string; // hex
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
}

export interface Deposito {
  id: string;
  zona_id: string;
  codigo: string;
  capacidad: number;
  litros: number;
  contenido?: string;
  estado: DepositoEstado;
  pos_x: number; // absolute on canvas
  pos_y: number;
  radio: number;
  ultimoMovimiento?: string;
}

export interface ProcesoActivo {
  id: string;
  tipo: "trasiego" | "limpieza" | "vendimia" | "embotellado" | "producto";
  origen_codigo?: string;
  destino_codigo?: string;
  operario: string;
  iniciado: string;
  litros?: number;
}

export const ESTADO_META: Record<
  DepositoEstado,
  { label: string; color: string }
> = {
  vacio: { label: "Vacío", color: "oklch(0.55 0.015 250)" },
  mosto: { label: "Mosto", color: "oklch(0.72 0.17 55)" },
  fermentacion: { label: "Fermentación", color: "oklch(0.70 0.18 145)" },
  vino: { label: "Vino terminado", color: "oklch(0.50 0.19 12)" },
  limpieza: { label: "Limpieza", color: "oklch(0.68 0.16 235)" },
  trasiego: { label: "Trasiego", color: "oklch(0.82 0.16 92)" },
  incidencia: { label: "Incidencia", color: "oklch(0.64 0.24 25)" },
};

export const CANVAS_W = 1400;
export const CANVAS_H = 900;

// ---- Seed data ----

const ZONAS_SEED: Omit<Zona, "ancho" | "alto" | "pos_x" | "pos_y">[] = [
  { id: "z-ext",  nombre: "Zona Exterior",   corto: "DP",   color: "#c9a84c" },
  { id: "z-auto", nombre: "Autovaciantes",   corto: "AUTO", color: "#5cbdb9" },
  { id: "z-dec",  nombre: "Zona Decanter",   corto: "L",    color: "#a78bfa" },
  { id: "z-n",    nombre: "Nave Interior N", corto: "N",    color: "#f59e0b" },
  { id: "z-d",    nombre: "Nave Interior D", corto: "D",    color: "#e85d3a" },
];

const ZONA_LAYOUT: Record<string, { pos_x: number; pos_y: number; ancho: number; alto: number }> = {
  "z-ext":  { pos_x: 30,  pos_y: 30,  ancho: 760, alto: 280 },
  "z-auto": { pos_x: 30,  pos_y: 340, ancho: 360, alto: 220 },
  "z-dec":  { pos_x: 410, pos_y: 340, ancho: 280, alto: 220 },
  "z-n":    { pos_x: 820, pos_y: 30,  ancho: 540, alto: 200 },
  "z-d":    { pos_x: 820, pos_y: 260, ancho: 540, alto: 300 },
};

export const ZONAS_INICIALES: Zona[] = ZONAS_SEED.map((z) => ({
  ...z,
  ...ZONA_LAYOUT[z.id],
}));

const ESTADOS_CYCLE: DepositoEstado[] = [
  "vacio", "vino", "fermentacion", "vino", "mosto",
  "vacio", "vino", "limpieza", "fermentacion", "vacio",
  "vino", "mosto", "vacio", "fermentacion", "incidencia",
];

const VARIEDADES = [
  "Airén 2024", "Tempranillo 2023", "Garnacha 2024",
  "Verdejo 2024", "Cencibel 2023", "Macabeo 2024",
];

function makeZonaDeps(
  zona: Zona,
  count: number,
  cols: number,
  capacidad: number,
  estadoOffset: number,
): Deposito[] {
  const cellW = (zona.ancho - 24) / cols;
  const rows = Math.ceil(count / cols);
  const cellH = (zona.alto - 50) / rows;
  const radio = Math.min(cellW, cellH) / 2 - 6;

  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const estado = ESTADOS_CYCLE[(i + estadoOffset) % ESTADOS_CYCLE.length];
    const llenado =
      estado === "vacio" || estado === "limpieza" ? 0 : 0.25 + ((i * 37) % 70) / 100;
    const codigo = `${zona.corto}-${String(i + 1).padStart(2, "0")}`;
    return {
      id: `${zona.id}-${i}`,
      zona_id: zona.id,
      codigo,
      capacidad,
      litros: Math.round(capacidad * llenado),
      contenido: estado === "vacio" || estado === "limpieza" ? undefined : VARIEDADES[i % VARIEDADES.length],
      estado,
      pos_x: zona.pos_x + 12 + col * cellW + cellW / 2,
      pos_y: zona.pos_y + 38 + row * cellH + cellH / 2,
      radio: Math.max(20, Math.min(32, radio)),
      ultimoMovimiento: estado === "vacio" ? "hace 12 días" : `hace ${(i % 9) + 1} h`,
    };
  });
}

export const DEPOSITOS_INICIALES: Deposito[] = (() => {
  const byId = Object.fromEntries(ZONAS_INICIALES.map((z) => [z.id, z]));
  return [
    ...makeZonaDeps(byId["z-ext"],  36, 12, 50000, 0),
    ...makeZonaDeps(byId["z-auto"], 10, 5,  25000, 3),
    ...makeZonaDeps(byId["z-dec"],   4, 4,  15000, 7),
    ...makeZonaDeps(byId["z-n"],    12, 6,  30000, 1),
    ...makeZonaDeps(byId["z-d"],    23, 8,  40000, 5),
  ];
})();

export const PROCESOS_ACTIVOS: ProcesoActivo[] = [
  { id: "p1", tipo: "trasiego", origen_codigo: "D-12", destino_codigo: "D-18", operario: "Juan M.", iniciado: "10:24", litros: 20000 },
  { id: "p2", tipo: "trasiego", origen_codigo: "DP-04", destino_codigo: "N-03", operario: "Lucía R.", iniciado: "09:50", litros: 12000 },
  { id: "p3", tipo: "limpieza", origen_codigo: "AUTO-02", operario: "Pedro G.", iniciado: "11:05" },
  { id: "p4", tipo: "vendimia", destino_codigo: "DP-22", operario: "Equipo A", iniciado: "08:15" },
];

export const ZONA_COLORS_PRESET = [
  "#c9a84c", "#5cbdb9", "#a78bfa", "#f59e0b",
  "#e85d3a", "#10b981", "#3b82f6", "#ec4899",
];
