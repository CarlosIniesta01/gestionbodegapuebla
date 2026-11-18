import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { listNotificaciones, marcarNotificacionesLeidas } from "@/lib/api/trabajadores.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Avisos internos de asignaciones (sin servicios externos). */
export function NotificacionesBell() {
  const fn = useServerFn(listNotificaciones);
  const leerFn = useServerFn(marcarNotificacionesLeidas);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notificaciones"], queryFn: () => fn(), refetchInterval: 60_000 });
  const items = (q.data ?? []) as any[];
  const noLeidas = items.filter((n) => !n.leida);
  const [open, setOpen] = React.useState(false);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v && noLeidas.length) leerFn({ data: { ids: noLeidas.map((n) => n.id) } }).then(() => qc.invalidateQueries({ queryKey: ["notificaciones"] }));
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button aria-label={`Avisos${noLeidas.length ? ` (${noLeidas.length} sin leer)` : ""}`} className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent">
          <Bell className="size-[18px]" />
          {noLeidas.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">{noLeidas.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-y-auto">
        <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">Avisos</div>
        {items.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Sin avisos.</div> : items.map((n) => (
          <Link key={n.id} to={n.tipo === "rechazo" ? "/trabajos" : "/mis-trabajos"} search={n.tipo === "rechazo" ? { op: undefined } : { t: n.trabajo_id ?? undefined }}
            onClick={() => onOpenChange(false)}
            className={`block px-3 py-2 border-b text-sm hover:bg-muted ${n.leida ? "text-muted-foreground" : ""}`}>
            <div className="font-medium">{n.titulo}</div>
            {n.cuerpo && <div className="text-xs">{n.cuerpo}</div>}
            <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</div>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}
