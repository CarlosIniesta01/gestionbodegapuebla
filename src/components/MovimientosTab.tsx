import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, FlaskConical, Wrench } from "lucide-react";
import { listMovimientos, createMovimiento } from "@/lib/api/movimientos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";
import { useBodegaMap } from "@/lib/use-bodega-map";

interface Props { bodegaId: string }

const TIPO_META: Record<string, { label: string; icon: any; color: string }> = {
  entrada:    { label: "Entrada",    icon: ArrowDownToLine, color: "text-emerald-500" },
  salida:     { label: "Salida",     icon: ArrowUpFromLine, color: "text-rose-500" },
  trasiego:   { label: "Trasiego",   icon: ArrowLeftRight,  color: "text-sky-500" },
  mezcla:     { label: "Mezcla",     icon: FlaskConical,    color: "text-violet-500" },
  embotellado:{ label: "Embotellado",icon: ArrowUpFromLine, color: "text-amber-500" },
  correccion: { label: "Corrección", icon: Wrench,          color: "text-orange-500" },
  ajuste:     { label: "Ajuste",     icon: Wrench,          color: "text-muted-foreground" },
};

export function MovimientosTab({ bodegaId }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listMovimientos);
  const create = useServerFn(createMovimiento);
  const listProd = useServerFn(listProductosComerciales);
  const { depositos } = useBodegaMap(bodegaId);

  const movsQ = useQuery({
    queryKey: ["movimientos", bodegaId],
    queryFn: () => list({ data: { bodegaId } }),
  });
  const prodsQ = useQuery({
    queryKey: ["productos-comerciales", bodegaId],
    queryFn: () => listProd({ data: { bodegaId } }),
  });
  const productos = (prodsQ.data ?? []) as any[];
  const movs = (movsQ.data ?? []) as any[];

  const [open, setOpen] = useState(false);
  const createM = useMutation({
    mutationFn: (d: any) => create({ data: { bodegaId, data: d } }),
    onSuccess: () => {
      toast.success("Movimiento registrado");
      qc.invalidateQueries({ queryKey: ["movimientos", bodegaId] });
      qc.invalidateQueries({ queryKey: ["existencias", bodegaId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const depositoLabel = (id: string | null) =>
    id ? (depositos.find((d) => d.id === id)?.codigo ?? id) : "—";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display">Movimientos</h3>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3.5" /> Nuevo movimiento
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Producto</th>
              <th className="text-left p-2">Origen</th>
              <th className="text-left p-2">Destino</th>
              <th className="text-right p-2">Litros</th>
              <th className="text-right p-2">Grado</th>
              <th className="text-right p-2">Alc. abs.</th>
              <th className="text-left p-2">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m) => {
              const meta = TIPO_META[m.tipo] ?? TIPO_META.ajuste;
              const Icon = meta.icon;
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{m.fecha} {m.hora?.slice(0,5)}</td>
                  <td className="p-2">
                    <span className={`inline-flex items-center gap-1 ${meta.color}`}>
                      <Icon className="size-3.5" /> {meta.label}
                    </span>
                  </td>
                  <td className="p-2">{m.productos_comerciales?.nombre ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{depositoLabel(m.deposito_origen_id)}</td>
                  <td className="p-2 font-mono text-xs">{depositoLabel(m.deposito_destino_id)}</td>
                  <td className="p-2 text-right tabular-nums">{Number(m.litros).toLocaleString("es-ES")}</td>
                  <td className="p-2 text-right tabular-nums">{m.grado ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{Number(m.alcohol_absoluto).toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                  <td className="p-2 text-xs text-muted-foreground truncate max-w-[200px]">{m.observaciones}</td>
                </tr>
              );
            })}
            {!movs.length && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground text-xs">No hay movimientos aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <MovimientoDialog
        open={open}
        onOpenChange={setOpen}
        productos={productos}
        depositos={depositos}
        onSave={(d) => createM.mutate(d)}
      />
    </div>
  );
}

function MovimientoDialog({
  open, onOpenChange, productos, depositos, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productos: any[];
  depositos: any[];
  onSave: (d: any) => void;
}) {
  const now = new Date();
  const [tipo, setTipo] = useState<string>("entrada");
  const [fecha, setFecha] = useState(now.toISOString().slice(0,10));
  const [hora, setHora] = useState(now.toTimeString().slice(0,5));
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [productoId, setProductoId] = useState("");
  const [litros, setLitros] = useState("");
  const [grado, setGrado] = useState("");
  const [obs, setObs] = useState("");

  useMemo(() => {
    if (open) {
      const n = new Date();
      setTipo("entrada");
      setFecha(n.toISOString().slice(0,10));
      setHora(n.toTimeString().slice(0,5));
      setOrigen(""); setDestino(""); setProductoId(""); setLitros(""); setGrado(""); setObs("");
    }
  }, [open]);

  const needsOrigen = ["salida","trasiego","mezcla","embotellado","correccion","ajuste"].includes(tipo);
  const needsDestino = ["entrada","trasiego","mezcla","correccion","ajuste"].includes(tipo);

  const canSave = !!tipo && !!litros && Number(litros) > 0
    && (!needsOrigen || !!origen)
    && (!needsDestino || !!destino);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nuevo movimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Tipo</div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(TIPO_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = tipo === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTipo(key)}
                    className={`p-2 rounded-lg border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                      active ? "border-foreground bg-secondary" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Icon className={`size-4 ${meta.color}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={cls} /></Field>
            <Field label="Hora"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={cls} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Origen ${needsOrigen ? "*" : ""}`}>
              <select value={origen} onChange={(e) => setOrigen(e.target.value)} disabled={!needsOrigen} className={cls}>
                <option value="">—</option>
                {depositos.map((d: any) => <option key={d.id} value={d.id}>{d.codigo}</option>)}
              </select>
            </Field>
            <Field label={`Destino ${needsDestino ? "*" : ""}`}>
              <select value={destino} onChange={(e) => setDestino(e.target.value)} disabled={!needsDestino} className={cls}>
                <option value="">—</option>
                {depositos.map((d: any) => <option key={d.id} value={d.id}>{d.codigo}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Producto">
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={cls}>
              <option value="">—</option>
              {productos.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Litros *">
              <input type="number" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} className={cls} />
            </Field>
            <Field label="Grado (°)">
              <input type="number" inputMode="decimal" step="0.1" value={grado} onChange={(e) => setGrado(e.target.value)} className={cls} placeholder="12.5" />
            </Field>
          </div>

          <Field label="Observaciones">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={cls} />
          </Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button
            disabled={!canSave}
            onClick={() => onSave({
              tipo,
              fecha,
              hora: hora.length === 5 ? `${hora}:00` : hora,
              deposito_origen_id: origen || null,
              deposito_destino_id: destino || null,
              producto_id: productoId || null,
              litros: Number(litros),
              grado: grado ? Number(grado) : null,
              observaciones: obs.trim() || null,
            })}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >Registrar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const cls = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm disabled:opacity-50";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
