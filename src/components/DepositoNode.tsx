import { motion } from "framer-motion";
import { ESTADO_META, type Deposito } from "@/lib/bodega-data";

interface Props {
  deposito: Deposito;
  selected?: boolean;
  editMode?: boolean;
  onClick?: () => void;
  onMoveEnd?: (x: number, y: number) => void;
  scale: number;
}

export function DepositoNode({ deposito, selected, editMode, onClick, onMoveEnd, scale }: Props) {
  const meta = ESTADO_META[deposito.estado];
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
      {/* Pulse ring for active deposits */}
      {active && !editMode && (
        <span
          className="absolute inset-0 rounded-full pulse-ring"
          style={{ border: `1.5px solid ${meta.color}` }}
        />
      )}

      {/* Container ring */}
      <span
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: "oklch(0.16 0.012 250)",
          border: `${selected ? 2.5 : 1.5}px solid ${selected ? "var(--accent)" : meta.color}`,
          boxShadow: active
            ? `0 0 ${Math.max(12, deposito.radio)}px color-mix(in oklab, ${meta.color} 45%, transparent)`
            : selected
            ? `0 0 16px color-mix(in oklab, var(--accent) 50%, transparent)`
            : undefined,
        }}
      >
        {/* Liquid fill */}
        <span
          className="absolute inset-x-0 bottom-0"
          style={{
            height: `${Math.max(4, pct)}%`,
            background: `linear-gradient(180deg, color-mix(in oklab, ${meta.color} 55%, transparent), color-mix(in oklab, ${meta.color} 80%, transparent))`,
          }}
        />
      </span>

      {/* Label */}
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold text-foreground select-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: Math.max(9, deposito.radio * 0.42),
          textShadow: "0 1px 2px oklch(0.16 0.012 250 / 0.6)",
          pointerEvents: "none",
        }}
      >
        {deposito.codigo}
      </span>
    </motion.button>
  );
}
