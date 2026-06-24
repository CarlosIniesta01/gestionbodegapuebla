// Identidad visual estable por centro (bodega).
// Color e icono se asignan determinísticamente a partir del id.

import {
  Factory, Warehouse, Building2, Wine, FlaskConical,
  Grape, Boxes, Truck,
} from "lucide-react";

const PALETTE = [
  { name: "burdeos",  color: "#7c2233", soft: "#fdecef", text: "#7c2233" },
  { name: "oliva",    color: "#5b6b2a", soft: "#f1f5e3", text: "#3f4a1c" },
  { name: "ocre",     color: "#a05a1f", soft: "#fceedd", text: "#7a4214" },
  { name: "azul",     color: "#1e4d78", soft: "#e6eff8", text: "#1e4d78" },
  { name: "verdemar", color: "#1f6b5a", soft: "#e1f1ec", text: "#1f6b5a" },
  { name: "violeta",  color: "#5b3a7a", soft: "#ede4f5", text: "#4a2e64" },
  { name: "tierra",   color: "#6b4423", soft: "#f3ead9", text: "#4d3019" },
  { name: "indigo",   color: "#34427a", soft: "#e6e9f5", text: "#2a356a" },
] as const;

const ICONS = [Factory, Warehouse, Building2, Wine, FlaskConical, Grape, Boxes, Truck];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type CentroIdentity = {
  color: string;
  soft: string;
  text: string;
  Icon: typeof Factory;
  initials: string;
};

export function centroIdentity(bodega?: { id?: string; nombre?: string } | null): CentroIdentity {
  const key = (bodega?.id ?? bodega?.nombre ?? "default") + "";
  const h = hashStr(key);
  const p = PALETTE[h % PALETTE.length];
  const Icon = ICONS[(h >> 3) % ICONS.length];
  const initials = (bodega?.nombre ?? "·")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "·";
  return { color: p.color, soft: p.soft, text: p.text, Icon, initials };
}

export const GLOBAL_IDENTITY: CentroIdentity = {
  color: "#0f172a",
  soft: "#eef2f7",
  text: "#0f172a",
  Icon: Boxes,
  initials: "GL",
};
