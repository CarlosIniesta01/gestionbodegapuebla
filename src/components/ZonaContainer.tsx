import { motion } from "framer-motion";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Zona } from "@/lib/bodega-data";

interface Props {
  zona: Zona;
  count: number;
  editMode: boolean;
  onMoveEnd: (x: number, y: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  scale: number;
}

export function ZonaContainer({ zona, count, editMode, onMoveEnd, onEdit, onDelete, scale }: Props) {
  return (
    <motion.div
      data-zona-root="1"
      drag={editMode}
      dragMomentum={false}
      dragElastic={0}
      dragListener={false}
      onDragEnd={(_, info) => {
        if (!editMode) return;
        onMoveEnd(zona.pos_x + info.offset.x / scale, zona.pos_y + info.offset.y / scale);
      }}
      className="absolute rounded-2xl pointer-events-auto"
      style={{
        left: zona.pos_x,
        top: zona.pos_y,
        width: zona.ancho,
        height: zona.alto,
        background: `color-mix(in oklab, ${zona.color} 8%, oklch(0.18 0.014 250))`,
        border: `2px dashed color-mix(in oklab, ${zona.color} 70%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${zona.color} 25%, transparent), 0 0 24px -8px color-mix(in oklab, ${zona.color} 30%, transparent)`,
      }}

    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: zona.color, boxShadow: `0 0 8px ${zona.color}` }}
          />
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase font-semibold tracking-[0.18em] truncate"
              style={{ color: `color-mix(in oklab, ${zona.color} 70%, white)`, fontFamily: "var(--font-mono)" }}
            >
              {zona.nombre}
            </div>
            <div className="text-[10px] text-muted-foreground">{count} depósitos · {zona.corto}</div>
          </div>
        </div>
        {editMode && (
          <ZonaActions onEdit={onEdit} onDelete={onDelete} dragOn={(e) => {
            const parent = (e.currentTarget as HTMLElement).closest('[data-zona-root="1"]');
            if (parent) {
              const evt = new PointerEvent("pointerdown", e.nativeEvent);
              parent.dispatchEvent(evt);
            }
          }} />
        )}
      </div>
      {editMode && (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0}
          onDragEnd={(_, info) => onMoveEnd(zona.pos_x + info.offset.x / scale, zona.pos_y + info.offset.y / scale)}
          className="absolute inset-x-0 top-0 h-9 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <div className="absolute right-20 top-2 text-muted-foreground/60">
            <GripVertical className="size-3.5" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function ZonaActions({ onEdit, onDelete, dragOn }: { onEdit: () => void; onDelete: () => void; dragOn: (e: React.MouseEvent) => void }) {
  return (
    <div className="flex items-center gap-1 relative z-10">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="size-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Editar zona"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="size-6 rounded hover:bg-destructive/20 flex items-center justify-center text-muted-foreground hover:text-destructive"
        aria-label="Eliminar zona"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
