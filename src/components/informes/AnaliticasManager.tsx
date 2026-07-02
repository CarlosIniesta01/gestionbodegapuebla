import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import {
  listAnaliticasLote, createAnaliticaLote, deleteAnaliticaLote, PARAMETROS_ANALITICA,
} from "@/lib/api/analiticas.functions";

type Props = {
  bodegaId: string;
  loteId: string;
  productoId?: string | null;
};

const ESTADOS = [
  { v: "conforme", label: "Conforme" },
  { v: "no_conforme", label: "No conforme" },
  { v: "pendiente", label: "Pendiente" },
] as const;

export function AnaliticasManager({ bodegaId, loteId, productoId }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAnaliticasLote);
  const createFn = useServerFn(createAnaliticaLote);
  const deleteFn = useServerFn(deleteAnaliticaLote);

  const q = useQuery({
    queryKey: ["analiticas", bodegaId, loteId],
    queryFn: () => listFn({ data: { bodegaId, loteId } }),
    enabled: !!bodegaId && !!loteId,
  });

  const [open, setOpen] = React.useState(false);
  const [fecha, setFecha] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [parametro, setParametro] = React.useState<string>(PARAMETROS_ANALITICA[0]);
  const [parametroLibre, setParametroLibre] = React.useState("");
  const [valor, setValor] = React.useState("");
  const [unidad, setUnidad] = React.useState("");
  const [estado, setEstado] = React.useState<"conforme" | "no_conforme" | "pendiente">("pendiente");
  const [observaciones, setObservaciones] = React.useState("");

  const reset = () => {
    setFecha(new Date().toISOString().slice(0, 10));
    setParametro(PARAMETROS_ANALITICA[0]);
    setParametroLibre("");
    setValor("");
    setUnidad("");
    setEstado("pendiente");
    setObservaciones("");
  };

  const createM = useMutation({
    mutationFn: async () => {
      const paramFinal = parametro === "Otros" ? (parametroLibre.trim() || "Otros") : parametro;
      const valorNum = valor.trim() === "" ? null : Number(valor.replace(",", "."));
      return createFn({
        data: {
          bodegaId,
          loteId,
          productoId: productoId ?? null,
          fecha,
          parametro: paramFinal,
          valor: valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
          valorTexto: valorNum == null || Number.isNaN(valorNum) ? valor.trim() || null : null,
          unidad: unidad.trim() || null,
          resultadoEstado: estado,
          observaciones: observaciones.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Analítica registrada.");
      qc.invalidateQueries({ queryKey: ["analiticas", bodegaId, loteId] });
      qc.invalidateQueries({ queryKey: ["informe-traza", bodegaId, loteId] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al registrar"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Analítica eliminada.");
      qc.invalidateQueries({ queryKey: ["analiticas", bodegaId, loteId] });
      qc.invalidateQueries({ queryKey: ["informe-traza", bodegaId, loteId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al eliminar"),
  });

  const rows = q.data ?? [];

  const estadoBadge = (e: string) => {
    if (e === "conforme") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Conforme</Badge>;
    if (e === "no_conforme") return <Badge className="bg-red-100 text-red-800 border-red-200">No conforme</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pendiente</Badge>;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 print:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FlaskConical className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Analíticas del lote</p>
            <p className="text-xs text-muted-foreground">{rows.length} registrada{rows.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="size-3.5" /> Registrar</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nueva analítica</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={estado} onValueChange={(v: any) => setEstado(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => <SelectItem key={e.v} value={e.v}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Parámetro</Label>
                <Select value={parametro} onValueChange={setParametro}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PARAMETROS_ANALITICA.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {parametro === "Otros" && (
                  <Input
                    placeholder="Nombre del parámetro"
                    value={parametroLibre}
                    onChange={(e) => setParametroLibre(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor</Label>
                <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="p. ej. 13,5" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <Input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="p. ej. % vol, g/L, mg/L" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createM.mutate()} disabled={createM.isPending}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {q.isLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No hay analíticas registradas para este lote.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="text-left font-medium py-1.5">Fecha</th>
                <th className="text-left font-medium py-1.5">Parámetro</th>
                <th className="text-right font-medium py-1.5">Valor</th>
                <th className="text-left font-medium py-1.5 pl-2">Unidad</th>
                <th className="text-left font-medium py-1.5">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-1.5">{new Date(r.fecha).toLocaleDateString("es-ES")}</td>
                  <td className="py-1.5">{r.parametro}</td>
                  <td className="py-1.5 text-right">{r.valor ?? r.valor_texto ?? "—"}</td>
                  <td className="py-1.5 pl-2">{r.unidad ?? "—"}</td>
                  <td className="py-1.5">{estadoBadge(r.resultado_estado)}</td>
                  <td className="py-1.5 text-right">
                    <Button size="icon" variant="ghost" onClick={() => deleteM.mutate(r.id)} disabled={deleteM.isPending}>
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
