import {
  Truck, PackageOpen, Hammer, Sparkles, Droplets, Beaker, Package,
  Send, Wrench, AlertTriangle, Bell, ShieldCheck, FlaskConical,
  type LucideIcon,
} from "lucide-react";

export const CAL_TIPOS = [
  { id: "carga",         label: "Carga camión",   icon: Truck,        color: "var(--state-vino)" },
  { id: "descarga",      label: "Descarga",       icon: PackageOpen,  color: "var(--state-fermentacion)" },
  { id: "trabajo",       label: "Trabajo",        icon: Hammer,       color: "var(--state-trasiego)" },
  { id: "limpieza",      label: "Limpieza",       icon: Sparkles,     color: "var(--state-limpieza)" },
  { id: "trasiego",      label: "Trasiego",       icon: Droplets,     color: "var(--state-trasiego)" },
  { id: "mezcla",        label: "Mezcla",         icon: Beaker,       color: "var(--accent)" },
  { id: "embotellado",   label: "Embotellado",    icon: Package,      color: "var(--state-vino)" },
  { id: "expedicion",    label: "Expedición",     icon: Send,         color: "var(--state-vino)" },
  { id: "mantenimiento", label: "Mantenimiento",  icon: Wrench,       color: "var(--muted-foreground)" },
  { id: "incidencia",    label: "Incidencia",     icon: AlertTriangle,color: "var(--state-incidencia)" },
  { id: "recordatorio",  label: "Recordatorio",   icon: Bell,         color: "var(--muted-foreground)" },
  { id: "auditoria",     label: "Auditoría",      icon: ShieldCheck,  color: "var(--accent)" },
  { id: "analisis",      label: "Análisis lab.",  icon: FlaskConical, color: "var(--state-fermentacion)" },
] as const;

export type CalTipo = typeof CAL_TIPOS[number]["id"];

export const CAL_TIPO_META: Record<CalTipo, { label: string; icon: LucideIcon; color: string }> =
  Object.fromEntries(CAL_TIPOS.map((t) => [t.id, t])) as any;

export const CAL_ESTADOS = [
  { id: "programado",  label: "Programado",  tone: "bg-state-trasiego/15 text-state-trasiego border-state-trasiego/40" },
  { id: "en_proceso",  label: "En proceso",  tone: "bg-state-fermentacion/15 text-state-fermentacion border-state-fermentacion/40" },
  { id: "completado",  label: "Completado",  tone: "bg-muted text-muted-foreground border-border" },
  { id: "cancelado",   label: "Cancelado",   tone: "bg-state-incidencia/10 text-state-incidencia border-state-incidencia/40" },
  { id: "retrasado",   label: "Retrasado",   tone: "bg-state-incidencia/15 text-state-incidencia border-state-incidencia/40" },
] as const;
export type CalEstado = typeof CAL_ESTADOS[number]["id"];
export const CAL_ESTADO_META: Record<CalEstado, { label: string; tone: string }> =
  Object.fromEntries(CAL_ESTADOS.map((e) => [e.id, e])) as any;

export const CAL_PRIORIDADES = [
  { id: "baja",    label: "Baja",    tone: "text-muted-foreground" },
  { id: "normal",  label: "Normal",  tone: "text-foreground" },
  { id: "alta",    label: "Alta",    tone: "text-state-trasiego" },
  { id: "critica", label: "Crítica", tone: "text-state-incidencia" },
] as const;
export type CalPrioridad = typeof CAL_PRIORIDADES[number]["id"];
