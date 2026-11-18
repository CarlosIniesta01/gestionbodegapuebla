import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Star } from "lucide-react";
import { listMiembrosBodega, puedeAsignar } from "@/lib/api/trabajadores.functions";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface AsignacionValue { trabajadores: string[]; responsableId: string | null; instrucciones: string }
export const ASIGNACION_VACIA: AsignacionValue = { trabajadores: [], responsableId: null, instrucciones: "" };

/** Sección «Asignar trabajo»: operarios autorizados del centro del trabajo (no del centro activo). */
export function AsignacionPicker({ bodegaId, value, onChange, conInstrucciones = true }: {
  bodegaId: string; value: AsignacionValue; onChange: (v: AsignacionValue) => void; conInstrucciones?: boolean;
}) {
  const listFn = useServerFn(listMiembrosBodega);
  const permFn = useServerFn(puedeAsignar);
  const permQ = useQuery({ queryKey: ["puede-asignar", bodegaId], queryFn: () => permFn({ data: { bodegaId } }), enabled: !!bodegaId });
  const q = useQuery({ queryKey: ["miembros-bodega", bodegaId], queryFn: () => listFn({ data: { bodegaId } }), enabled: !!bodegaId && permQ.data === true });
  if (permQ.data === false) return null;
  const miembros = (q.data ?? []) as any[];

  const toggle = (uid: string) => {
    const sel = value.trabajadores.includes(uid) ? value.trabajadores.filter((x) => x !== uid) : [...value.trabajadores, uid];
    let resp = value.responsableId && sel.includes(value.responsableId) ? value.responsableId : null;
    if (sel.length === 1) resp = sel[0];
    onChange({ ...value, trabajadores: sel, responsableId: resp });
  };

  return (
    <section className="border-t border-border pt-3 space-y-2" aria-label="Asignar trabajo">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Users className="size-3.5" /> Asignar trabajo <span className="normal-case tracking-normal">(opcional · puedes distribuirlo después)</span>
      </div>
      {q.isLoading ? <div className="text-xs text-muted-foreground">Cargando operarios…</div>
      : miembros.length === 0 ? <div className="text-xs text-muted-foreground">No hay operarios activos en este centro.</div>
      : (
        <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
          {miembros.map((m) => {
            const sel = value.trabajadores.includes(m.user_id);
            const resp = value.responsableId === m.user_id;
            const nombre = m.profile?.nombre || m.profile?.email || "Usuario";
            return (
              <div key={m.user_id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${sel ? "border-primary bg-primary/5" : "border-border"}`}>
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                  <input type="checkbox" checked={sel} onChange={() => toggle(m.user_id)} aria-label={`Asignar ${nombre}`} />
                  <span className="truncate">{nombre}</span>
                  <span className="text-[10px] text-muted-foreground">{m.role?.nombre}</span>
                </label>
                {sel && value.trabajadores.length > 1 && (
                  <button type="button" title="Responsable de ejecución" aria-label={`Responsable ${nombre}`}
                    onClick={() => onChange({ ...value, responsableId: m.user_id })}
                    className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${resp ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                    <Star className="size-3" />{resp ? "Responsable" : "Hacer resp."}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {value.trabajadores.length > 1 && !value.responsableId && (
        <div className="text-xs text-destructive">Selecciona el responsable de ejecución.</div>
      )}
      {conInstrucciones && (
        <div>
          <Label>Instrucciones para los trabajadores</Label>
          <Textarea rows={2} maxLength={4000} value={value.instrucciones} onChange={(e) => onChange({ ...value, instrucciones: e.target.value })} />
        </div>
      )}
    </section>
  );
}
