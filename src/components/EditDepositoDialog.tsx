import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ESTADO_META, type Deposito, type DepositoEstado, type Zona } from "@/lib/bodega-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deposito: Deposito | null; // null = create
  zonas: Zona[];
  onSave: (data: {
    codigo: string;
    zona_id: string;
    capacidad: number;
    litros: number;
    estado: DepositoEstado;
    contenido?: string;
    radio: number;
  }) => void;
  onDelete?: () => void;
}

const ESTADOS: DepositoEstado[] = ["vacio", "mosto", "fermentacion", "vino", "limpieza", "trasiego", "incidencia"];

export function EditDepositoDialog({ open, onOpenChange, deposito, zonas, onSave, onDelete }: Props) {
  const [codigo, setCodigo] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [capacidad, setCapacidad] = useState(20000);
  const [litros, setLitros] = useState(0);
  const [estado, setEstado] = useState<DepositoEstado>("vacio");
  const [contenido, setContenido] = useState("");
  const [radio, setRadio] = useState(24);

  useEffect(() => {
    if (open) {
      setCodigo(deposito?.codigo ?? "");
      setZonaId(deposito?.zona_id ?? zonas[0]?.id ?? "");
      setCapacidad(deposito?.capacidad ?? 20000);
      setLitros(deposito?.litros ?? 0);
      setEstado(deposito?.estado ?? "vacio");
      setContenido(deposito?.contenido ?? "");
      setRadio(deposito?.radio ?? 24);
    }
  }, [open, deposito, zonas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{deposito ? `Editar ${deposito.codigo}` : "Nuevo depósito"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={input} />
            </Field>
            <Field label="Zona">
              <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} className={input}>
                {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacidad (L)">
              <input type="number" min={0} value={capacidad} onChange={(e) => setCapacidad(+e.target.value)} className={input} />
            </Field>
            <Field label="Litros actuales">
              <input type="number" min={0} max={capacidad} value={litros} onChange={(e) => setLitros(+e.target.value)} className={input} />
            </Field>
          </div>

          <Field label="Estado">
            <div className="grid grid-cols-4 gap-1.5">
              {ESTADOS.map((s) => {
                const meta = ESTADO_META[s];
                const active = estado === s;
                return (
                  <button
                    key={s}
                    onClick={() => setEstado(s)}
                    className={`p-2 rounded-lg border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                      active ? "border-foreground" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Contenido / variedad">
            <input value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="ej. Airén 2024" className={input} />
          </Field>

          <Field label={`Tamaño visual (${radio}px)`}>
            <input type="range" min={16} max={40} value={radio} onChange={(e) => setRadio(+e.target.value)} className="w-full accent-accent" />
          </Field>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {deposito && onDelete && (
              <button
                onClick={() => { onDelete(); onOpenChange(false); }}
                className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg"
              >
                Eliminar
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
              disabled={!codigo.trim() || !zonaId}
              onClick={() => {
                onSave({
                  codigo: codigo.trim(), zona_id: zonaId, capacidad,
                  litros: Math.min(litros, capacidad), estado,
                  contenido: contenido.trim() || undefined, radio,
                });
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

const input = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
