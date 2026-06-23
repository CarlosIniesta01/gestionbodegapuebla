import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  previewReinicioOperativoGlobal,
  ejecutarReinicioOperativoGlobal,
} from "@/lib/api/reinicio.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function fmt(n: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
}

export function ReinicioOperativoTab() {
  const fnPreview = useServerFn(previewReinicioOperativoGlobal);
  const fnEjecutar = useServerFn(ejecutarReinicioOperativoGlobal);
  const qc = useQueryClient();

  const previewQ = useQuery({
    queryKey: ["reinicio", "preview"],
    queryFn: () => fnPreview(),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const ejecutarM = useMutation({
    mutationFn: () => fnEjecutar({ data: { confirmacion: "REINICIAR" } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Reinicio completado: ${res.ajustados} depósitos ajustados a 0 L.`);
      } else {
        toast.error(`Reinicio parcial: ${res.ajustados} ajustados. Errores: ${res.errores.length}`);
        res.errores.forEach((e) => toast.error(e));
      }
      setConfirmOpen(false);
      setConfirmText("");
      qc.invalidateQueries({ queryKey: ["reinicio"] });
      qc.invalidateQueries({ queryKey: ["existencias"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al ejecutar"),
  });

  if (previewQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="size-4 animate-spin" /> Calculando situación actual…
      </div>
    );
  }
  if (previewQ.error) {
    return <div className="p-6 text-destructive">Error: {(previewQ.error as Error).message}</div>;
  }

  const data = previewQ.data!;
  const { lineas, excluidos, resumen, bodegas } = data;
  const sinNada = lineas.length === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex gap-3">
        <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-medium">Reinicio operativo global del ERP</p>
          <p>
            Esta acción genera un movimiento de tipo <b>ajuste de salida</b> en cada depósito de todas las
            bodegas en las que eres administrador, dejando sus existencias a <b>0 L</b>.
            Se conserva todo el histórico (movimientos, contratos, auditoría, trabajos, lotes).
          </p>
          <p>
            <b>Excepción:</b> los depósitos con producto <b>Enocianina</b> no se modifican.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Bodegas accesibles" value={bodegas.length} />
        <Stat label="Bodegas afectadas" value={resumen.totalBodegasAfectadas} />
        <Stat label="Depósitos a ajustar" value={resumen.totalDepositosAfectados} />
        <Stat label="Litros totales" value={`${fmt(resumen.totalLitrosAjustados)} L`} />
      </div>

      {resumen.totalDepositosExcluidos > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">Excluidos por Enocianina</Badge>
            <span className="text-sm text-muted-foreground">{resumen.totalDepositosExcluidos} depósitos intactos</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {excluidos.map((e) => `${e.bodegaNombre} · ${e.depositoId} (${fmt(e.litros)} L)`).join(" · ")}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-medium">Vista previa del ajuste</h3>
          <span className="text-xs text-muted-foreground">{lineas.length} líneas</span>
        </div>
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Bodega</th>
                <th className="px-3 py-2 font-medium">Depósito</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium text-right">Litros actuales</th>
                <th className="px-3 py-2 font-medium text-right">A ajustar</th>
              </tr>
            </thead>
            <tbody>
              {lineas.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No hay existencias que ajustar.
                </td></tr>
              )}
              {lineas.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">{l.bodegaNombre}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.depositoId}</td>
                  <td className="px-3 py-2">{l.productoNombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(l.litros)} L</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">−{fmt(l.litros)} L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="destructive"
          disabled={sinNada || ejecutarM.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <RotateCcw className="size-4 mr-2" />
          Ejecutar reinicio operativo global
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Confirmar reinicio operativo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Vas a generar <b>{resumen.totalDepositosAfectados}</b> movimientos de ajuste en
                  <b> {resumen.totalBodegasAfectadas}</b> bodegas, ajustando un total de
                  <b> {fmt(resumen.totalLitrosAjustados)} L</b>.
                </p>
                <p>Esta acción quedará registrada en auditoría y no se puede deshacer fácilmente.</p>
                <div>
                  <Label htmlFor="confirm">Escribe <b>REINICIAR</b> para confirmar:</Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                    className="mt-1"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ejecutarM.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "REINICIAR" || ejecutarM.isPending}
              onClick={(e) => { e.preventDefault(); ejecutarM.mutate(); }}
            >
              {ejecutarM.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Ejecutando…</>
              ) : (
                <>Ejecutar reinicio</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
