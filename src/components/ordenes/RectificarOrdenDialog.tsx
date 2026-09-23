import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, FileText, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rectificarOrdenLogistica } from "@/lib/api/ordenes-logisticas.functions";

type Modo = "informativa" | "operativa";

const CAMPOS_INFO: { key: string; label: string }[] = [
  { key: "numero_operacion", label: "Nº operación" },
  { key: "transportista", label: "Transportista" },
  { key: "empresa_transportista", label: "Empresa transportista" },
  { key: "matricula", label: "Matrícula" },
  { key: "remolque_matricula", label: "Matrícula remolque" },
  { key: "conductor_nombre", label: "Conductor" },
  { key: "conductor_documento", label: "Documento conductor" },
  { key: "conductor_telefono", label: "Teléfono conductor" },
  { key: "numero_precinto", label: "Nº precinto" },
  { key: "precintos_adicionales", label: "Precintos adicionales" },
];

export function RectificarOrdenDialog({
  orden,
  open,
  onOpenChange,
}: {
  orden: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const rectificar = useServerFn(rectificarOrdenLogistica);
  const [modo, setModo] = React.useState<Modo>("informativa");
  const [motivo, setMotivo] = React.useState("");
  const [valores, setValores] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setMotivo("");
    setValores({});
    setModo("informativa");
  }, [open]);

  const set = (k: string, v: string) => setValores((p) => ({ ...p, [k]: v }));
  const valor = (k: string) => valores[k] ?? (orden?.[k] != null ? String(orden[k]) : "");

  const isCarga = orden?.tipo === "carga";

  const m = useMutation({
    mutationFn: async () => {
      const cambios: Record<string, string> = {};
      const keys =
        modo === "informativa"
          ? [...CAMPOS_INFO.map((c) => c.key), "observaciones"]
          : ["litros_reales", "grado", isCarga ? "deposito_origen_id" : "deposito_destino_id"];
      for (const k of keys) {
        const v = valores[k];
        if (v !== undefined && v !== "" && String(orden?.[k] ?? "") !== v) cambios[k] = v;
      }
      if (Object.keys(cambios).length === 0) throw new Error("No has modificado ningún dato");
      return rectificar({ data: { id: orden.id, modo, motivo, cambios } });
    },
    onSuccess: (res: any) => {
      toast.success(
        res.modo === "operativa"
          ? "Orden rectificada: existencias y contratos actualizados"
          : "Datos corregidos correctamente",
      );
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["orden-log", orden.id] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["existencias"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo rectificar la orden"),
  });

  const depKey = isCarga ? "deposito_origen_id" : "deposito_destino_id";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rectificar orden</DialogTitle>
          <DialogDescription>
            La orden original y su movimiento se conservan. Toda corrección queda registrada con su motivo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModo("informativa")}
            className={`text-left rounded-md border p-3 transition ${modo === "informativa" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <FileText className="size-4" /> Corrección informativa
            </div>
            <p className="text-xs text-muted-foreground mt-1">Transporte, conductor, precintos, albarán. No afecta a existencias.</p>
          </button>
          <button
            type="button"
            onClick={() => setModo("operativa")}
            className={`text-left rounded-md border p-3 transition ${modo === "operativa" ? "border-destructive bg-destructive/5" : "border-border"}`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <Wrench className="size-4" /> Corrección operativa
            </div>
            <p className="text-xs text-muted-foreground mt-1">Litros, grado o depósito. Recalcula existencias y contratos.</p>
          </button>
        </div>

        {modo === "operativa" && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>
              El movimiento actual quedará marcado como corregido y se generará uno nuevo enlazado al anterior. Las existencias y
              los saldos de contrato se recalcularán automáticamente.
            </span>
          </div>
        )}

        <div className="space-y-3">
          {modo === "informativa" ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {CAMPOS_INFO.map((c) => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-xs">{c.label}</Label>
                  <Input value={valor(c.key)} onChange={(e) => set(c.key, e.target.value)} />
                </div>
              ))}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={valor("observaciones")} onChange={(e) => set("observaciones", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Litros reales</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valor("litros_reales")}
                  onChange={(e) => set("litros_reales", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Actual: {orden?.litros_reales ?? "—"} L</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grado</Label>
                <Input type="number" step="0.01" value={valor("grado")} onChange={(e) => set("grado", e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Actual: {orden?.grado ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isCarga ? "Depósito origen" : "Depósito destino"}</Label>
                <Input value={valor(depKey)} onChange={(e) => set(depKey, e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Actual: {orden?.[depKey] ?? "—"}</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Motivo de la rectificación (obligatorio)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica por qué se corrige esta orden (mínimo 10 caracteres)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={modo === "operativa" ? "destructive" : "default"}
            disabled={motivo.trim().length < 10 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Guardando…" : "Rectificar orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
