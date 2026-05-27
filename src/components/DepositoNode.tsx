import { motion } from "framer-motion";
import { ESTADO_META, type Deposito } from "@/lib/bodega-data";

interface Props {
  deposito: Deposito;
  cx: number;
  cy: number;
  r: number;
  onClick?: () => void;
  selected?: boolean;
}

export function DepositoNode({ deposito, cx, cy, r, onClick, selected }: Props) {
  const meta = ESTADO_META[deposito.estado];
  const llenado = deposito.capacidad ? deposito.litros / deposito.capacidad : 0;
  const active = deposito.estado === "trasiego" || deposito.estado === "fermentacion";

  // Liquid fill height inside circle
  const fillH = r * 2 * Math.max(0.04, llenado);
  const fillY = cy + r - fillH;

  const clipId = `clip-${deposito.id}`;

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      className="group"
    >
      {active && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 2}
          fill="none"
          stroke={meta.color}
          strokeWidth={1.5}
          opacity={0.6}
          className="pulse-ring"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}

      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="oklch(0.18 0.013 250)"
        stroke={selected ? "var(--accent)" : meta.color}
        strokeWidth={selected ? 2.5 : 1.5}
        opacity={0.95}
      />

      {/* Liquid */}
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r - 2} />
        </clipPath>
      </defs>
      <rect
        x={cx - r}
        y={fillY}
        width={r * 2}
        height={fillH}
        fill={meta.color}
        opacity={0.55}
        clipPath={`url(#${clipId})`}
      />

      {/* Center dot for empty deposits */}
      {deposito.estado === "vacio" && (
        <circle cx={cx} cy={cy} r={2} fill={meta.color} opacity={0.5} />
      )}

      {/* Label */}
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        fontSize={r > 18 ? 10 : 9}
        fontWeight={600}
        fill="oklch(0.96 0.005 250)"
        style={{ fontFamily: "var(--font-mono)", pointerEvents: "none" }}
      >
        {deposito.id}
      </text>

      {/* Hover glow */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={r + 6}
        fill={meta.color}
        opacity={0}
        whileHover={{ opacity: 0.15 }}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}
