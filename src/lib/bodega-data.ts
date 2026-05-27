export type DepositoEstado =
  | "vacio"
  | "mosto"
  | "fermentacion"
  | "vino"
  | "limpieza"
  | "trasiego"
  | "incidencia";

export interface Deposito {
  id: string;
  zona: ZonaId;
  capacidad: number;
  litros: number;
  contenido?: string;
  variedad?: string;
  estado: DepositoEstado;
  ultimoMovimiento?: string;
  // grid position within zone
  col: number;
  row: number;
}

export type ZonaId = "exterior" | "autovaciantes" | "decanter" | "nave-n" | "nave-d";

export const ZONAS: { id: ZonaId; nombre: string; corto: string }[] = [
  { id: "exterior", nombre: "Zona Exterior", corto: "DP" },
  { id: "autovaciantes", nombre: "Autovaciantes", corto: "AUTO" },
  { id: "decanter", nombre: "Zona Decanter", corto: "L" },
  { id: "nave-n", nombre: "Nave Interior N", corto: "N" },
  { id: "nave-d", nombre: "Nave Interior D", corto: "D" },
];

export const ESTADO_META: Record<
  DepositoEstado,
  { label: string; color: string; ring: string }
> = {
  vacio: { label: "Vacío", color: "var(--state-empty)", ring: "oklch(0.55 0.015 250 / 0.3)" },
  mosto: { label: "Mosto", color: "var(--state-mosto)", ring: "oklch(0.72 0.17 55 / 0.45)" },
  fermentacion: { label: "Fermentación", color: "var(--state-fermentacion)", ring: "oklch(0.70 0.18 145 / 0.5)" },
  vino: { label: "Vino terminado", color: "var(--state-vino)", ring: "oklch(0.50 0.19 12 / 0.5)" },
  limpieza: { label: "Limpieza", color: "var(--state-limpieza)", ring: "oklch(0.68 0.16 235 / 0.5)" },
  trasiego: { label: "Trasiego", color: "var(--state-trasiego)", ring: "oklch(0.82 0.16 92 / 0.55)" },
  incidencia: { label: "Incidencia", color: "var(--state-incidencia)", ring: "oklch(0.64 0.24 25 / 0.6)" },
};

// Deterministic mock generator
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const estados: DepositoEstado[] = [
  "vacio", "vino", "fermentacion", "vino", "mosto",
  "vacio", "vino", "limpieza", "fermentacion", "vacio",
  "vino", "mosto", "vacio", "fermentacion",
];

const variedades = ["Airén 2024", "Tempranillo 2023", "Garnacha 2024", "Verdejo 2024", "Cencibel 2023", "Macabeo 2024"];

function makeZona(prefix: string, zona: ZonaId, count: number, capacidad: number, cols: number, startEstadoIdx = 0): Deposito[] {
  return Array.from({ length: count }, (_, i) => {
    const estado = pick(estados, i + startEstadoIdx);
    const llenado = estado === "vacio" ? 0 : estado === "limpieza" ? 0 : 0.25 + ((i * 37) % 70) / 100;
    return {
      id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
      zona,
      capacidad,
      litros: Math.round(capacidad * llenado),
      contenido: estado === "vacio" || estado === "limpieza" ? undefined : pick(variedades, i),
      variedad: estado === "vacio" || estado === "limpieza" ? undefined : pick(variedades, i),
      estado,
      ultimoMovimiento: estado === "vacio" ? "Hace 12 días" : "Hace " + ((i % 9) + 1) + "h",
      col: i % cols,
      row: Math.floor(i / cols),
    };
  });
}

export const DEPOSITOS: Deposito[] = [
  ...makeZona("DP", "exterior", 36, 50000, 12, 0),
  ...makeZona("AUTO", "autovaciantes", 10, 25000, 5, 3),
  ...makeZona("L", "decanter", 4, 15000, 4, 7),
  ...makeZona("N", "nave-n", 12, 30000, 6, 1),
  ...makeZona("D", "nave-d", 23, 40000, 8, 5),
];

// Active processes (mock)
export interface ProcesoActivo {
  id: string;
  tipo: "trasiego" | "limpieza" | "vendimia" | "embotellado" | "producto";
  origen?: string;
  destino?: string;
  operario: string;
  iniciado: string;
  litros?: number;
}

export const PROCESOS_ACTIVOS: ProcesoActivo[] = [
  { id: "p1", tipo: "trasiego", origen: "D-12", destino: "D-18", operario: "Juan M.", iniciado: "10:24", litros: 20000 },
  { id: "p2", tipo: "trasiego", origen: "DP-04", destino: "N-03", operario: "Lucía R.", iniciado: "09:50", litros: 12000 },
  { id: "p3", tipo: "limpieza", origen: "AUTO-02", operario: "Pedro G.", iniciado: "11:05" },
  { id: "p4", tipo: "vendimia", destino: "DP-22", operario: "Equipo A", iniciado: "08:15" },
];
