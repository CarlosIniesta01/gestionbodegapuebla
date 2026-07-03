import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Plus } from "lucide-react";

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

import { createAnaliticaLote, PARAMETROS_ANALITICA } from "@/lib/api/analiticas.functions";
import { listLotes } from "@/lib/api/lotes.functions";

const ESTADOS = [
  { v: "conforme", label: "Conforme" },
  { v: "no_conforme", label: "No conforme" },
  { v: "pendiente", label: "Pendiente" },
] as const;

type Props = {
  bodegaId: string;
  loteId?: string | null;
  productoId?: string | null;
  depositoId?: string | null;
  /** Etiqueta opcional del contexto (p. ej. código de depósito o nº de lote). */
  contextoLabel?: string;
  trigger?: React.ReactNode;
  onCreated?: () => void;
};

export function RegistrarAnaliticaDialog({
  bodegaId, loteId, productoId, depositoId, contextoLabel, trigger, onCreated,
}: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAnaliticaLote);
  const listLotesFn = useServerFn(listLotes);

  const [open, setOpen] = React.useState(false);
  React.useEffect(() => () => setOpen(false), []);

  const needPickLote = !loteId;
  const lotesQ = useQuery({
    queryKey: ["lotes-picker", bodegaId],
    queryFn: () => listLotesFn({ data: { bodegaId } }),
    enabled: open && needPickLote,
  });

  const [selectedLoteId, setSelectedLoteId] = React.useState<string>("");
  const [fecha, setFecha] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [parametro, setParametro] = React.useState<string>(PARAMETROS_ANALITICA[0]);
  const [parametroLibre, setParametroLibre] = React.useState("");
  const [valor, setValor] = React.useState("");
  const [unidad, setUnidad] = React.useState("");
  const [estado, setEstado] = React.useState<"conforme" | "no_conforme" | "pendiente">("pendiente");
  const [observaciones, setObservaciones] = React.useState("");

  const reset = () => {
    setSelectedLoteId("");
    setFecha(new Date().toISOString().slice(0, 10));
    setParametro(PARAMETROS_ANALITICA[0]);
    setParametroLibre("");
    setValor("");
    setUnidad("");
    setEstado("pendiente");
    setObservaciones("");
  };

  const effectiveLoteId = loteId ?? selectedLoteId;
  const effectiveProductoId = React.useMemo(() => {
    if (productoId) return productoId;
    if (!needPickLote) return null;
    const row = (lotesQ.data ?? []).find((l: any) => l.id === selectedLoteId);
    return row?.producto_id ?? null;
  }, [productoId, needPickLote, lotesQ.data, selectedLoteId]);

  const createM = useMutation({
    mutationFn: async () => {
      if (!effectiveLoteId) throw new Error("Selecciona un lote");
      const paramFinal = parametro === "Otros" ? (parametroLibre.trim() || "Otros") : parametro;
      const valorNum = valor.trim() === "" ? null : Number(valor.replace(",", "."));
      return createFn({
        data: {
          bodegaId,
          loteId: effectiveLoteId,
          productoId: effectiveProductoId ?? null,
          depositoId: depositoId ?? null,
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
      qc.invalidateQueries({ queryKey: ["analiticas"] });
      qc.invalidateQueries({ queryKey: ["informe-traza"] });
      reset();
      setOpen(false);
      onCreated?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al registrar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <FlaskConical className="size-3.5" /> Registrar analítica
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva analítica</DialogTitle>
          {contextoLabel && (
            <p className="text-xs text-muted-foreground">{contextoLabel}</p>
          )}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {needPickLote && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Lote *</Label>
              <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                <SelectTrigger>
                  <SelectValue placeholder={lotesQ.isLoading ? "Cargando…" : "Selecciona un lote"} />
                </SelectTrigger>
                <SelectContent>
                  {(lotesQ.data ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.numero_lote} · {l.productos?.nombre ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
  );
}

/** Botón compacto que abre el diálogo. Reutilizable en cualquier ficha. */
export function RegistrarAnaliticaButton(props: Props & { label?: string; size?: "sm" | "default" }) {
  const { label = "Registrar analítica", size = "sm", ...rest } = props;
  return (
    <RegistrarAnaliticaDialog
      {...rest}
      trigger={
        <Button size={size} variant="outline" className="gap-1.5">
          <Plus className="size-3.5" /> {label}
        </Button>
      }
    />
  );
}
