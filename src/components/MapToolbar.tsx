import { Eye, Pencil, Plus, RotateCcw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  editMode: boolean;
  onToggleEdit: () => void;
  onAddZona: () => void;
  onAddDeposito: () => void;
  onReset: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  procesosCount: number;
  zonasCount: number;
  depositosCount: number;
}

export function MapToolbar({
  editMode, onToggleEdit, onAddZona, onAddDeposito, onReset,
  zoom, onZoom, procesosCount, zonasCount, depositosCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border bg-surface/80">
      {/* Mode switch */}
      <div className="inline-flex bg-background/60 rounded-lg border border-border p-0.5 relative">
        {(["vista", "editar"] as const).map((m) => {
          const active = (m === "editar") === editMode;
          return (
            <button
              key={m}
              onClick={() => { if ((m === "editar") !== editMode) onToggleEdit(); }}
              className={`relative px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 rounded-md bg-secondary border border-border"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {m === "vista" ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
                {m === "vista" ? "Vista" : "Editar"}
              </span>
            </button>
          );
        })}
      </div>

      {editMode && (
        <>
          <button
            onClick={onAddZona}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background/60 hover:bg-secondary flex items-center gap-1.5"
          >
            <Plus className="size-3.5" /> Zona
          </button>
          <button
            onClick={onAddDeposito}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background/60 hover:bg-secondary flex items-center gap-1.5"
          >
            <Plus className="size-3.5" /> Depósito
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background/60 hover:bg-secondary flex items-center gap-1.5 text-muted-foreground"
            title="Restablecer mapa"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:flex items-center gap-3 text-[11px] text-muted-foreground px-2">
          <span>{zonasCount} zonas</span>
          <span>·</span>
          <span>{depositosCount} depósitos</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-state-fermentacion animate-ping opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-state-fermentacion" />
            </span>
            {procesosCount} en curso
          </span>
        </div>

        <div className="inline-flex items-center bg-background/60 rounded-lg border border-border">
          <button
            onClick={() => onZoom(Math.max(0.4, zoom - 0.1))}
            className="size-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Reducir zoom"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="text-[11px] tabular-nums w-10 text-center text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoom(Math.min(1.6, zoom + 0.1))}
            className="size-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            onClick={() => onZoom(1)}
            className="size-7 flex items-center justify-center text-muted-foreground hover:text-foreground border-l border-border"
            aria-label="Restablecer zoom"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
