import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsignacionPicker, type AsignacionValue } from "@/components/asignacion/AsignacionPicker";

export type Prioridad = "baja" | "normal" | "alta" | "urgente";

interface Props {
  bodegaId: string;
  scheduledAt: Date | undefined;
  onScheduledAtChange: (d: Date | undefined) => void;
  hora: string;
  onHoraChange: (s: string) => void;
  prioridad: Prioridad;
  onPrioridadChange: (p: Prioridad) => void;
  asignacion: AsignacionValue;
  onAsignacionChange: (a: AsignacionValue) => void;
}

/** Programación (fecha, prioridad) + sección común «Asignar trabajo» de B1. */
export function ProgramarYAsignar({
  bodegaId, scheduledAt, onScheduledAtChange, hora, onHoraChange,
  prioridad, onPrioridadChange, asignacion, onAsignacionChange,
}: Props) {
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="grid sm:grid-cols-[1fr_160px] gap-3">
        <div>
          <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Programar</Label>
          <div className="flex gap-2 mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !scheduledAt && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {scheduledAt ? format(scheduledAt, "dd/MM/yyyy") : "Elige una fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={scheduledAt} onSelect={onScheduledAtChange}
                  initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Input type="time" value={hora} onChange={(e) => onHoraChange(e.target.value)} className="w-[120px]" />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Prioridad</Label>
          <Select value={prioridad} onValueChange={(v) => onPrioridadChange(v as Prioridad)}>
            <SelectTrigger className="mt-2" aria-label="Prioridad"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <AsignacionPicker bodegaId={bodegaId} value={asignacion} onChange={onAsignacionChange} />
    </div>
  );
}

export function combineDateTime(d: Date | undefined, hhmm: string): string | undefined {
  if (!d) return undefined;
  const out = new Date(d);
  if (hhmm) {
    const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
    if (!isNaN(h)) out.setHours(h, m || 0, 0, 0);
  } else {
    out.setHours(9, 0, 0, 0);
  }
  return out.toISOString();
}
