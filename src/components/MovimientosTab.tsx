import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, FlaskConical, Wrench, Pencil, Ban, Copy } from "lucide-react";
import {
  listMovimientos, createMovimiento, editMovimiento, anularMovimiento, puedeRectificar,
  listExistencias,
} from "@/lib/api/movimientos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";
import { listContratosCompra, listContratosVenta } from "@/lib/api/contratos.functions";
import { useBodegaMap } from "@/lib/use-bodega-map";

function derivarEstadoDeposito(grado: number | null | undefined, currentEstado?: string): string {
  if (grado != null && !Number.isNaN(grado)) {
    if (grado >= 11) return "vino";
    return "fermentacion";
  }
  if (currentEstado && currentEstado !== "vacio" && currentEstado !== "limpieza") return currentEstado;
  return "vino";
}

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

const ESTADO_BADGE: Record<string, string> = {
  activo:    "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  corregido: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  anulado:   "bg-rose-500/15 text-rose-600 border-rose-500/30 line-through opacity-70",
};

export function MovimientosTab({ bodegaId }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listMovimientos);
  const create = useServerFn(createMovimiento);
  const edit = useServerFn(editMovimiento);
  const anular = useServerFn(anularMovimiento);
  const canRectFn = useServerFn(puedeRectificar);
  const listProd = useServerFn(listProductosComerciales);
  const listCC = useServerFn(listContratosCompra);
  const listCV = useServerFn(listContratosVenta);
  const listExistFn = useServerFn(listExistencias);
  const { depositos, updateDeposito } = useBodegaMap(bodegaId);

  const movsQ = useQuery({
    queryKey: ["movimientos", bodegaId],
    queryFn: () => list({ data: { bodegaId } }),
  });
  const prodsQ = useQuery({
    queryKey: ["productos-comerciales", bodegaId],
    queryFn: () => listProd({ data: { bodegaId } }),
  });
  const rectQ = useQuery({
    queryKey: ["puede-rectificar", bodegaId],
    queryFn: () => canRectFn({ data: { bodegaId } }),
  });
  const ccQ = useQuery({ queryKey: ["contratos-compra", bodegaId], queryFn: () => listCC({ data: { bodegaId } }) });
  const cvQ = useQuery({ queryKey: ["contratos-venta", bodegaId], queryFn: () => listCV({ data: { bodegaId } }) });
  const productos = (prodsQ.data ?? []) as any[];
  const movs = (movsQ.data ?? []) as any[];
  const contratosCompra = (ccQ.data ?? []) as any[];
  const contratosVenta = (cvQ.data ?? []) as any[];
  const canRect = !!rectQ.data;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [duplicating, setDuplicating] = useState<any | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movimientos", bodegaId] });
    qc.invalidateQueries({ queryKey: ["existencias", bodegaId] });
    qc.invalidateQueries({ queryKey: ["contratos-compra", bodegaId] });
    qc.invalidateQueries({ queryKey: ["contratos-venta", bodegaId] });
  };

  // Sincroniza el depósito (contenido / estado / vacío) tras crear o editar
  // un movimiento, evitando que el usuario tenga que abrir "Editar depósito".
  const sincronizarDepositos = async (d: any) => {
    const destinoId: string | null = d.deposito_destino_id ?? null;
    const origenId: string | null = d.deposito_origen_id ?? null;
    const prod = d.producto_id ? productos.find((p) => p.id === d.producto_id) : null;
    const tipo: string = d.tipo;

    // 1) Aplicar producto/estado al destino (entrada, trasiego, mezcla)
    if (destinoId && prod && (tipo === "entrada" || tipo === "trasiego" || tipo === "mezcla")) {
      const dest = depositos.find((x) => x.id === destinoId);
      const estado = derivarEstadoDeposito(d.grado, dest?.estado);
      updateDeposito(destinoId, { contenido: prod.nombre, estado });
    }

    // 2) Tras el recálculo de existencias, marcar como vacío los depósitos a 0L.
    try {
      const rows = (await listExistFn({ data: { bodegaId } })) as any[];
      qc.setQueryData(["existencias", bodegaId], rows);
      const totalFor = (id: string) => rows
        .filter((r) => r?.deposito_id === id)
        .reduce((s, r) => s + (Number(r?.litros) || 0), 0);
      const targets = Array.from(new Set([origenId, destinoId].filter(Boolean))) as string[];
      for (const id of targets) {
        if (totalFor(id) <= 0.01) {
          updateDeposito(id, { estado: "vacio", contenido: "" });
        }
      }
    } catch { /* ignore */ }
  };

  const createM = useMutation({
    mutationFn: (d: any) => create({ data: { bodegaId, data: d } }),
    onSuccess: (_res, vars) => {
      toast.success("Movimiento registrado");
      invalidate();
      setOpen(false);
      setDuplicating(null);
      void sincronizarDepositos(vars);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editM = useMutation({
    mutationFn: (p: { id: string; data: any; motivo: string }) =>
      edit({ data: { bodegaId, id: p.id, data: p.data, motivo: p.motivo } }),
    onSuccess: (_res, vars) => {
      toast.success("Movimiento corregido");
      invalidate();
      setEditing(null);
      void sincronizarDepositos(vars.data);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const anularM = useMutation({
    mutationFn: (p: { id: string; motivo: string }) => anular({ data: { bodegaId, id: p.id, motivo: p.motivo } }),
    onSuccess: (_res, vars) => {
      toast.success("Movimiento anulado");
      invalidate();
      setAnulandoId(null);
      // Sincroniza usando los depósitos del movimiento anulado
      const mv = movs.find((m) => m.id === vars.id);
      if (mv) void sincronizarDepositos(mv);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const depositoLabel = (id: string | null) =>
    id ? (depositos.find((d) => d.id === id)?.codigo ?? id) : "—";

  const anulando = movs.find((m) => m.id === anulandoId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display">Movimientos</h3>
        <button
          onClick={() => { setEditing(null); setDuplicating(null); setOpen(true); }}
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
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Producto</th>
              <th className="text-left p-2">Origen</th>
              <th className="text-left p-2">Destino</th>
              <th className="text-right p-2">Litros</th>
              <th className="text-right p-2">Grado</th>
              <th className="text-right p-2">Alc.</th>
              <th className="text-left p-2">Obs.</th>
              <th className="text-right p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m) => {
              const meta = TIPO_META[m.tipo] ?? TIPO_META.ajuste;
              const Icon = meta.icon;
              const estado = m.estado_movimiento ?? "activo";
              const rowCls = estado === "anulado" ? "opacity-60" : estado === "corregido" ? "bg-amber-500/5" : "";
              return (
                <tr key={m.id} className={`border-t border-border ${rowCls}`}>
                  <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{m.fecha} {m.hora?.slice(0,5)}</td>
                  <td className="p-2">
                    <span className={`inline-flex items-center gap-1 ${meta.color}`}>
                      <Icon className="size-3.5" /> {meta.label}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${ESTADO_BADGE[estado]}`}>{estado}</span>
                  </td>
                  <td className="p-2">{m.productos_comerciales?.nombre ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{depositoLabel(m.deposito_origen_id)}</td>
                  <td className="p-2 font-mono text-xs">{depositoLabel(m.deposito_destino_id)}</td>
                  <td className="p-2 text-right tabular-nums">{Number(m.litros).toLocaleString("es-ES")}</td>
                  <td className="p-2 text-right tabular-nums">{m.grado ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{Number(m.alcohol_absoluto).toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                  <td className="p-2 text-xs text-muted-foreground truncate max-w-[200px]" title={m.motivo_anulacion || m.motivo_correccion || m.observaciones || ""}>
                    {m.observaciones}
                    {m.motivo_correccion && <div className="text-[10px] text-amber-600">↻ {m.motivo_correccion}</div>}
                    {m.motivo_anulacion && <div className="text-[10px] text-rose-600">✕ {m.motivo_anulacion}</div>}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button
                      title="Duplicar"
                      onClick={() => { setEditing(null); setDuplicating(m); setOpen(true); }}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    ><Copy className="size-3.5" /></button>
                    {canRect && estado === "activo" && (
                      <>
                        <button
                          title="Editar (con motivo)"
                          onClick={() => { setDuplicating(null); setEditing(m); setOpen(true); }}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                        ><Pencil className="size-3.5" /></button>
                        <button
                          title="Anular"
                          onClick={() => setAnulandoId(m.id)}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-rose-500"
                        ><Ban className="size-3.5" /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!movs.length && (
              <tr><td colSpan={11} className="p-6 text-center text-muted-foreground text-xs">No hay movimientos aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!canRect && (
        <div className="text-[11px] text-muted-foreground">
          Solo administradores o responsables pueden editar o anular movimientos.
        </div>
      )}

      <MovimientoDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setDuplicating(null); } }}
        productos={productos}
        depositos={depositos}
        contratosCompra={contratosCompra}
        contratosVenta={contratosVenta}
        editing={editing}
        duplicating={duplicating}
        onSave={(d, motivo) => {
          if (editing) editM.mutate({ id: editing.id, data: d, motivo: motivo! });
          else createM.mutate(d);
        }}
      />

      <AnularDialog
        open={!!anulandoId}
        movimiento={anulando}
        onOpenChange={(v) => { if (!v) setAnulandoId(null); }}
        onConfirm={(motivo) => anularM.mutate({ id: anulandoId!, motivo })}
      />
    </div>
  );
}

function MovimientoDialog({
  open, onOpenChange, productos, depositos, contratosCompra, contratosVenta, onSave, editing, duplicating,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productos: any[];
  depositos: any[];
  contratosCompra: any[];
  contratosVenta: any[];
  editing: any | null;
  duplicating: any | null;
  onSave: (d: any, motivo?: string) => void;
}) {
  const seed = editing ?? duplicating;
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
  const [motivo, setMotivo] = useState("");
  const [contratoCompraId, setContratoCompraId] = useState("");
  const [contratoVentaId, setContratoVentaId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (seed) {
      setTipo(seed.tipo);
      setFecha(seed.fecha);
      setHora(seed.hora?.slice(0,5) ?? now.toTimeString().slice(0,5));
      setOrigen(seed.deposito_origen_id ?? "");
      setDestino(seed.deposito_destino_id ?? "");
      setProductoId(seed.producto_id ?? "");
      setLitros(String(seed.litros ?? ""));
      setGrado(seed.grado != null ? String(seed.grado) : "");
      setObs(seed.observaciones ?? "");
      setContratoCompraId(seed.contrato_compra_id ?? "");
      setContratoVentaId(seed.contrato_venta_id ?? "");
    } else {
      const n = new Date();
      setTipo("entrada");
      setFecha(n.toISOString().slice(0,10));
      setHora(n.toTimeString().slice(0,5));
      setOrigen(""); setDestino(""); setProductoId(""); setLitros(""); setGrado(""); setObs("");
      setContratoCompraId(""); setContratoVentaId("");
    }
    setMotivo("");
  }, [open, editing?.id, duplicating?.id]);

  const needsOrigen = ["salida","trasiego","mezcla","embotellado","correccion","ajuste"].includes(tipo);
  const needsDestino = ["entrada","trasiego","mezcla","correccion","ajuste"].includes(tipo);

  const canSave = !!tipo && !!litros && Number(litros) > 0
    && (!needsOrigen || !!origen)
    && (!needsDestino || !!destino)
    && (!editing || motivo.trim().length >= 3);

  const title = editing ? "Editar movimiento (corrección)" : duplicating ? "Duplicar movimiento" : "Nuevo movimiento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {editing && (
            <div className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
              El movimiento original quedará marcado como <b>corregido</b>. Se creará uno nuevo enlazado y las existencias se recalcularán.
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Tipo</div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(TIPO_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = tipo === key;
                return (
                  <button key={key} type="button" onClick={() => setTipo(key)}
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

          <Field label={
            tipo === "mezcla" ? "Producto resultante *" :
            tipo === "entrada" || tipo === "trasiego" ? "Producto *" : "Producto"
          }>
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className={cls}>
              <option value="">—</option>
              {productos.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
              ))}
            </select>
            {(tipo === "entrada" || tipo === "trasiego" || tipo === "mezcla") && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Se asignará automáticamente al depósito destino (contenido, color y estado).
              </p>
            )}
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

          {tipo === "entrada" && (
            <Field label="Contrato de compra (opcional)">
              <select value={contratoCompraId} onChange={(e) => setContratoCompraId(e.target.value)} className={cls}>
                <option value="">— Sin contrato —</option>
                {contratosCompra
                  .filter((c: any) => c.estado !== "cancelado" && c.estado !== "completado"
                    && (!productoId || !c.producto_id || c.producto_id === productoId))
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.numero_contrato} · {c.proveedores?.nombre ?? "—"} · pend. {Number(c.litros_pendientes).toLocaleString("es-ES")} L
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {tipo === "salida" && (
            <Field label="Contrato de venta (opcional)">
              <select value={contratoVentaId} onChange={(e) => setContratoVentaId(e.target.value)} className={cls}>
                <option value="">— Sin contrato —</option>
                {contratosVenta
                  .filter((c: any) => c.estado !== "cancelado" && c.estado !== "completado"
                    && (!productoId || !c.producto_id || c.producto_id === productoId))
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.numero_contrato} · {c.clientes?.nombre ?? "—"} · pend. {Number(c.litros_pendientes).toLocaleString("es-ES")} L
                    </option>
                  ))}
              </select>
            </Field>
          )}

          {editing && (
            <Field label="Motivo de la corrección *">
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className={cls}
                placeholder="Ej.: error en litros registrados" />
            </Field>
          )}
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
              contrato_compra_id: tipo === "entrada" ? (contratoCompraId || null) : null,
              contrato_venta_id: tipo === "salida" ? (contratoVentaId || null) : null,
            }, editing ? motivo.trim() : undefined)}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >{editing ? "Guardar corrección" : "Registrar"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnularDialog({ open, movimiento, onOpenChange, onConfirm }: {
  open: boolean; movimiento: any | null; onOpenChange: (v: boolean) => void; onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (open) setMotivo(""); }, [open]);
  const canSave = motivo.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader><DialogTitle className="font-display">Anular movimiento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-[12px] text-muted-foreground">
            El registro <b>no se elimina</b> de la base de datos. Quedará marcado como anulado, excluido de las existencias y visible en auditoría.
          </div>
          {movimiento && (
            <div className="text-xs bg-secondary/40 rounded p-2 font-mono">
              {movimiento.tipo} · {movimiento.litros} L · {movimiento.fecha} {movimiento.hora?.slice(0,5)}
            </div>
          )}
          <Field label="Motivo de la anulación *">
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={cls}
              placeholder="Ej.: registro duplicado" />
          </Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary">Cancelar</button>
          <button disabled={!canSave} onClick={() => onConfirm(motivo.trim())}
            className="px-4 py-2 text-sm rounded-lg bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50">
            Anular
          </button>
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
