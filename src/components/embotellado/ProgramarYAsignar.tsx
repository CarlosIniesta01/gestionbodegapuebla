import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { listBodegaMembers } from "@/lib/api/productos.functions";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export interface AsignadoSel { user_id: string; rol: string }

interface Props {
  bodegaId: string;
  scheduledAt: Date | undefined;
  onScheduledAtChange: (d: Date | undefined) => void;
  hora: string;
  onHoraChange: (s: string) => void;
  asignados: AsignadoSel[];
  onAsignadosChange: (a: AsignadoSel[]) => void;
}

export function ProgramarYAsignar({
  bodegaId, scheduledAt, onScheduledAtChange, hora, onHoraChange,
  asignados, onAsignadosChange,
}: Props) {
  const fn = useServerFn(listBodegaMembers);
  const q = useQuery({
    queryKey: ["bodega-members", bodegaId],
    queryFn: () => fn({ data: { bodegaId } }),
    enabled: !!bodegaId,
  });
  const [filtro, setFiltro] = React.useState("");
  const miembros = (q.data ?? []).filter((m) =>
    !filtro || m.nombre.toLowerCase().includes(filtro.toLowerCase()),
  );

  const toggle = (uid: string) => {
    const i = asignados.findIndex((a) => a.user_id === uid);
    if (i >= 0) onAsignadosChange(asignados.filter((a) => a.user_id !== uid));
    else onAsignadosChange([...asignados, { user_id: uid, rol: "operario" }]);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
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
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Asignar empleado {asignados.length > 0 && <span className="text-foreground normal-case">· {asignados.length}</span>}
          </Label>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar miembro…" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="pl-8" />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {q.isLoading && <div className="p-3 text-sm text-muted-foreground">Cargando…</div>}
          {!q.isLoading && miembros.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">Sin miembros</div>
          )}
          {miembros.map((m) => {
            const sel = asignados.some((a) => a.user_id === m.user_id);
            return (
              <button type="button" key={m.user_id} onClick={() => toggle(m.user_id)}
                className={cn("w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-sidebar-accent/40 transition-colors", sel && "bg-primary/5")}>
                <Checkbox checked={sel} onCheckedChange={() => toggle(m.user_id)} />
                <Avatar className="size-8">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback>{m.nombre.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.nombre}</div>
                  {m.rol_nombre && (
                    <Badge variant="outline" className="mt-0.5 text-[10px] py-0 h-4"
                      style={{ borderColor: m.rol_color ?? undefined, color: m.rol_color ?? undefined }}>
                      {m.rol_nombre}
                    </Badge>
                  )}
                </div>
                {sel && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
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
