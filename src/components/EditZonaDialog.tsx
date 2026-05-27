import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ZONA_COLORS_PRESET, type Zona } from "@/lib/bodega-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zona: Zona | null; // null = create
  onSave: (data: { nombre: string; corto: string; color: string }) => void;
  onDelete?: () => void;
}

export function EditZonaDialog({ open, onOpenChange, zona, onSave, onDelete }: Props) {
  const [nombre, setNombre] = useState("");
  const [corto, setCorto] = useState("");
  const [color, setColor] = useState(ZONA_COLORS_PRESET[0]);

  useEffect(() => {
    if (open) {
      setNombre(zona?.nombre ?? "");
      setCorto(zona?.corto ?? "");
      setColor(zona?.color ?? ZONA_COLORS_PRESET[0]);
    }
  }, [open, zona]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display">{zona ? "Editar zona" : "Nueva zona"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Nombre">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Nave Interior N"
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Prefijo">
            <input
              value={corto}
              onChange={(e) => setCorto(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ej. N"
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm font-mono"
            />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {ZONA_COLORS_PRESET.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                    color === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </Field>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {zona && onDelete && (
              <button
                onClick={() => { onDelete(); onOpenChange(false); }}
                className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg"
              >
                Eliminar zona
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              disabled={!nombre.trim() || !corto.trim()}
              onClick={() => {
                onSave({ nombre: nombre.trim(), corto: corto.trim(), color });
                onOpenChange(false);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
