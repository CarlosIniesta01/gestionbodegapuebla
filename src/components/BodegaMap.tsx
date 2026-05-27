import { useMemo, useState } from "react";
import { DEPOSITOS, PROCESOS_ACTIVOS, ZONAS, type Deposito, type ZonaId } from "@/lib/bodega-data";
import { DepositoNode } from "./DepositoNode";
import { DepositoPanel } from "./DepositoPanel";

interface ZonaLayout {
  id: ZonaId;
  nombre: string;
  x: number;
  y: number;
  cols: number;
  cellW: number;
  cellH: number;
  r: number;
}

const ZONAS_LAYOUT: ZonaLayout[] = [
  { id: "exterior",      nombre: "ZONA EXTERIOR",     x: 40,  y: 60,  cols: 12, cellW: 56, cellH: 56, r: 22 },
  { id: "autovaciantes", nombre: "AUTOVACIANTES",     x: 40,  y: 260, cols: 5,  cellW: 64, cellH: 60, r: 22 },
  { id: "decanter",      nombre: "ZONA DECANTER",     x: 400, y: 260, cols: 4,  cellW: 64, cellH: 60, r: 22 },
  { id: "nave-n",        nombre: "NAVE INTERIOR N",   x: 720, y: 60,  cols: 6,  cellW: 56, cellH: 56, r: 22 },
  { id: "nave-d",        nombre: "NAVE INTERIOR D",   x: 720, y: 260, cols: 8,  cellW: 56, cellH: 56, r: 22 },
];

function depositoXY(d: Deposito): { cx: number; cy: number; r: number } {
  const z = ZONAS_LAYOUT.find((z) => z.id === d.zona)!;
  return {
    cx: z.x + d.col * z.cellW + z.cellW / 2,
    cy: z.y + d.row * z.cellH + z.cellH / 2 + 20,
    r: z.r,
  };
}

export function BodegaMap() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const positions = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number; r: number }>();
    DEPOSITOS.forEach((d) => map.set(d.id, depositoXY(d)));
    return map;
  }, []);

  const selected = DEPOSITOS.find((d) => d.id === selectedId) ?? null;

  const trasiegos = PROCESOS_ACTIVOS.filter(
    (p) => p.tipo === "trasiego" && p.origen && p.destino,
  );

  return (
    <>
      <div className="scada-panel grid-bg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mapa operativo</div>
            <div className="font-display font-semibold">Bodega Central · Vista en tiempo real</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-state-fermentacion animate-pulse" />
            LIVE
          </div>
        </div>
        <div className="overflow-auto">
          <svg
            viewBox="0 0 1180 740"
            className="w-full h-auto min-w-[900px]"
            role="img"
            aria-label="Mapa interactivo de bodega"
          >
            {/* Zone backgrounds */}
            {ZONAS_LAYOUT.map((z) => {
              const w = z.cols * z.cellW + 20;
              const zoneDeps = DEPOSITOS.filter((d) => d.zona === z.id);
              const rows = Math.max(...zoneDeps.map((d) => d.row)) + 1;
              const h = rows * z.cellH + 50;
              return (
                <g key={z.id}>
                  <rect
                    x={z.x - 10}
                    y={z.y}
                    width={w}
                    height={h}
                    rx={14}
                    fill="oklch(0.20 0.014 250 / 0.6)"
                    stroke="oklch(0.30 0.018 250)"
                    strokeWidth={1}
                  />
                  <text
                    x={z.x}
                    y={z.y + 20}
                    fontSize={10}
                    fill="oklch(0.68 0.018 250)"
                    style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.18em" }}
                  >
                    {z.nombre}
                  </text>
                </g>
              );
            })}

            {/* Active trasiego lines */}
            {trasiegos.map((t) => {
              const a = positions.get(t.origen!);
              const b = positions.get(t.destino!);
              if (!a || !b) return null;
              return (
                <g key={t.id}>
                  <line
                    x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                    stroke="var(--state-trasiego)"
                    strokeWidth={2}
                    opacity={0.35}
                  />
                  <line
                    x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                    stroke="var(--state-trasiego)"
                    strokeWidth={2}
                    className="flow-dash"
                  />
                </g>
              );
            })}

            {/* Deposits */}
            {DEPOSITOS.map((d) => {
              const p = positions.get(d.id)!;
              return (
                <DepositoNode
                  key={d.id}
                  deposito={d}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  selected={selectedId === d.id}
                  onClick={() => setSelectedId(d.id)}
                />
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 border-t border-border text-[11px]">
          {Object.entries({
            vacio: "Vacío",
            mosto: "Mosto",
            fermentacion: "Fermentación",
            vino: "Vino terminado",
            limpieza: "Limpieza",
            trasiego: "Trasiego",
            incidencia: "Incidencia",
          }).map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ background: `var(--state-${k})` }} />
              {label}
            </div>
          ))}
          <div className="ml-auto text-muted-foreground">
            {ZONAS.length} zonas · {DEPOSITOS.length} depósitos
          </div>
        </div>
      </div>

      <DepositoPanel deposito={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}
