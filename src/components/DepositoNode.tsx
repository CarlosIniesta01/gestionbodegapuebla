import { motion } from "framer-motion";
import { type Deposito } from "@/lib/bodega-data";
import { useColorSettings } from "@/lib/use-color-settings";

interface Props {
  deposito: Deposito;
  selected?: boolean;
  editMode?: boolean;
  filling?: boolean;
  onClick?: () => void;
  onMoveEnd?: (x: number, y: number) => void;
  scale: number;
}

export function DepositoNode({ deposito, selected, editMode, filling, onClick, onMoveEnd, scale }: Props) {
  const colors = useColorSettings();
  const meta = colors.getEstadoMeta(deposito.estado);
  const color = colors.getDepositoColor(deposito);
  const llenado = deposito.capacidad > 0 ? deposito.litros / deposito.capacidad : 0;
  const pct = Math.round(llenado * 100);

  const active = deposito.estado === "trasiego" || deposito.estado === "fermentacion";
  const size = deposito.radio * 2;

  return (
    <motion.button
      type="button"
      drag={editMode}
      dragMomentum={false}
      dragElastic={0}
      dragTransition={{ power: 0 }}
      onDragEnd={(_, info) => {
        if (!editMode || !onMoveEnd) return;
        onMoveEnd(
          deposito.pos_x + info.offset.x / scale,
          deposito.pos_y + info.offset.y / scale,
        );
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      whileHover={editMode ? { scale: 1.05 } : { scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      aria-label={`Depósito ${deposito.codigo}, ${meta.label}, ${deposito.litros} litros, ${pct}%`}
      className="absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
      style={{
        left: deposito.pos_x - deposito.radio,
        top: deposito.pos_y - deposito.radio,
        width: size,
        height: size,
        cursor: editMode ? "grab" : "pointer",
        touchAction: editMode ? "none" : undefined,
      }}
    >
      {/* Container ring */}
      <span
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: "var(--surface-elevated)",
          border: `${selected ? 2 : 1}px solid ${selected ? "var(--primary)" : `color-mix(in oklab, ${color} 55%, var(--border))`}`,
          boxShadow: selected
            ? `0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent), 0 2px 8px -2px color-mix(in oklab, var(--primary) 25%, transparent)`
            : active
            ? `0 0 0 2px color-mix(in oklab, ${color} 18%, transparent), 0 1px 3px rgba(15,23,42,0.06)`
            : `0 1px 2px rgba(15,23,42,0.05)`,
        }}
      >
        {/* Liquid fill with looping wave surface */}
        {(pct > 0 || filling) && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`liq-${deposito.id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0.65" />
              </linearGradient>
            </defs>
            <g
              className={filling ? "liquid-filling" : undefined}
              transform={filling ? undefined : `translate(0 ${100 - Math.max(4, pct)})`}
            >
              <path
                className="liquid-wave"
                fill={`url(#liq-${deposito.id})`}
                d="M0,4 C15,0 35,8 50,4 C65,0 85,8 100,4 L200,4 C215,0 235,8 250,4 C265,0 285,8 300,4 L300,120 L0,120 Z"
              />
              <path
                className="liquid-wave-2"
                fill={color}
                fillOpacity="0.22"
                d="M0,5 C15,9 35,1 50,5 C65,9 85,1 100,5 L200,5 C215,9 235,1 250,5 C265,9 285,1 300,5 L300,120 L0,120 Z"
              />
            </g>
          </svg>
        )}
      </span>

      {/* Label */}
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold text-foreground select-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: Math.max(9, deposito.radio * 0.44),
          letterSpacing: "-0.01em",
          pointerEvents: "none",
        }}
      >
        {deposito.codigo}
      </span>
    </motion.button>
  );
}
