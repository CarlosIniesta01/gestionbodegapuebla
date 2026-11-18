import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getTrabajo } from "@/lib/api/trabajos.functions";
import { actualizarProgramacion, puedeAsignar } from "@/lib/api/trabajadores.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const toLocal = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function ProgramacionTab({ bodegaId, trabajoId }: { bodegaId: string; trabajoId: string }) {
  const getFn = useServerFn(getTrabajo);
  const updFn = useServerFn(actualizarProgramacion);
  const permFn = useServerFn(puedeAsignar);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["trabajo", trabajoId], queryFn: () => getFn({ data: { id: trabajoId } }) });
  const permQ = useQuery({ queryKey: ["puede-asignar", bodegaId], queryFn: () => permFn({ data: { bodegaId } }) });
  const t: any = q.data?.trabajo;
  const [fecha, setFecha] = useState(""); const [prio, setPrio] = useState("normal");
  const [instr, setInstr] = useState(""); const [motivo, setMotivo] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (t) { setFecha(toLocal(t.scheduled_at)); setPrio(t.prioridad); setInstr(t.instrucciones ?? ""); } }, [t?.id, t?.updated_at]);
  if (!t) return <div className="text-xs text-muted-foreground">Cargando…</div>;
  const editable = permQ.data === true && t.estado === "pendiente";

  async function guardar() {
    setSaving(true);
    try {
      await updFn({ data: { trabajoId, scheduledAt: fecha ? new Date(fecha).toISOString() : null, prioridad: prio as any, instrucciones: instr || null, motivo: motivo || undefined } });
      toast.success("Programación actualizada"); setMotivo("");
      qc.invalidateQueries({ queryKey: ["trabajo", trabajoId] }); qc.invalidateQueries({ queryKey: ["trabajos"] }); qc.invalidateQueries({ queryKey: ["distribucion"] });
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  const historial = (q.data?.eventos ?? []).filter((e: any) => e.tipo === "programacion");
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Fecha y hora previstas</Label><Input type="datetime-local" disabled={!editable} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><Label>Prioridad</Label>
          <select disabled={!editable} value={prio} onChange={(e) => setPrio(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
          </select>
        </div>
      </div>
      <div><Label>Instrucciones para los trabajadores</Label><Textarea rows={4} disabled={!editable} value={instr} onChange={(e) => setInstr(e.target.value)} /></div>
      {editable && (
        <>
          <div><Label>Motivo del cambio</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          <Button onClick={guardar} disabled={saving}>Guardar programación</Button>
        </>
      )}
      {!editable && <div className="text-xs text-muted-foreground">{t.estado !== "pendiente" ? "La programación solo se modifica antes de la ejecución." : "Solo los responsables del centro pueden modificar la programación."}</div>}
      {historial.length > 0 && (
        <ul className="text-xs text-muted-foreground border-t pt-2 space-y-1">
          {historial.map((e: any) => <li key={e.id}>{new Date(e.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })} · {e.contenido}</li>)}
        </ul>
      )}
    </div>
  );
}
