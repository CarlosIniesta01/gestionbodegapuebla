import { Droplets, Grape, Beaker, Sparkles, Package, AlertTriangle, MessageSquare, Truck, PackageOpen, type LucideIcon } from "lucide-react";

export const TRABAJO_TIPOS = [
  { id: "trasiego", label: "Trasiego", icon: Droplets, color: "var(--state-trasiego)" },
  { id: "vendimia", label: "Vendimia", icon: Grape, color: "var(--state-fermentacion)" },
  { id: "producto", label: "Producto enológico", icon: Beaker, color: "var(--accent)" },
  { id: "limpieza", label: "Limpieza", icon: Sparkles, color: "var(--state-limpieza)" },
  { id: "embotellado", label: "Embotellado", icon: Package, color: "var(--state-vino)" },
  { id: "carga", label: "Orden de carga", icon: Truck, color: "var(--state-trasiego)" },
  { id: "descarga", label: "Orden de descarga", icon: PackageOpen, color: "var(--state-fermentacion)" },
  { id: "incidencia", label: "Incidencia", icon: AlertTriangle, color: "var(--state-incidencia)" },
  { id: "observacion", label: "Observación", icon: MessageSquare, color: "var(--muted-foreground)" },
] as const;

export type TrabajoTipo = typeof TRABAJO_TIPOS[number]["id"];

export const TIPO_META: Record<TrabajoTipo, { label: string; icon: LucideIcon; color: string }> =
  Object.fromEntries(TRABAJO_TIPOS.map((t) => [t.id, t])) as any;

export const ESTADO_LABEL: Record<string, { label: string; tone: string }> = {
  pendiente: { label: "Pendiente", tone: "bg-state-trasiego/20 text-state-trasiego border-state-trasiego/40" },
  en_curso: { label: "En curso", tone: "bg-state-fermentacion/20 text-state-fermentacion border-state-fermentacion/40" },
  completado: { label: "Completado", tone: "bg-muted text-muted-foreground border-border" },
  cancelado: { label: "Cancelado", tone: "bg-state-incidencia/15 text-state-incidencia border-state-incidencia/40" },
};

export const PRIORIDAD_LABEL: Record<string, { label: string; tone: string }> = {
  baja: { label: "Baja", tone: "text-muted-foreground" },
  normal: { label: "Normal", tone: "text-foreground" },
  alta: { label: "Alta", tone: "text-state-trasiego" },
  urgente: { label: "Urgente", tone: "text-state-incidencia" },
};
