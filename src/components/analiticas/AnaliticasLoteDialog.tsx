import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

import {
  listAnaliticasLote, deleteAnaliticaLote,
} from "@/lib/api/analiticas.functions";
import { RegistrarAnaliticaDialog } from "./RegistrarAnaliticaDialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  loteId: string;
  productoId?: string | null;
  numeroLote?: string;
};

function estadoBadge(e: string) {
  if (e === "conforme") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Conforme</Badge>;
  if (e === "no_conforme") return <Badge className="bg-red-100 text-red-800 border-red-200">No conforme</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pendiente</Badge>;
}

export function AnaliticasLoteDialog({
  open, onOpenChange, bodegaId, loteId, productoId, numeroLote,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAnaliticasLote);
  const deleteFn = useServerFn(deleteAnaliticaLote);

  const q = useQuery({
    queryKey: ["analiticas", bodegaId, loteId],
    queryFn: () => listFn({ data: { bodegaId, loteId } }),
    enabled: open && !!bodegaId && !!loteId,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-surface border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            Analíticas {numeroLote ? `— Lote ${numeroLote}` : "del lote"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <RegistrarAnaliticaDialog
            bodegaId={bodegaId}
            loteId={loteId}
            productoId={productoId ?? null}
            contextoLabel={numeroLote ? `Lote ${numeroLote}` : undefined}
          />
        </div>

        {q.isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
