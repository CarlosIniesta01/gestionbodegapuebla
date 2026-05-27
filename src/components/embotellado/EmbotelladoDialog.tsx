import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wine, Beaker, ArrowLeft, Plus, Trash2, Package } from "lucide-react";
import { motion } from "framer-motion";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useBodegaMap } from "@/lib/use-bodega-map";
import { useQuery } from "@tanstack/react-query";
import { listProductos } from "@/lib/api/productos.functions";
import { crearEmbotelladoDirecto, crearElaboracionPropia } from "@/lib/api/embotellado.functions";
import { ProgramarYAsignar, combineDateTime, type AsignadoSel } from "./ProgramarYAsignar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
}

type Modo = "select" | "directo" | "elaboracion";

const FORMATOS = ["0,75 L", "1,5 L", "3 L", "Otro"];
const UNIDADES = ["g", "kg", "ml", "L", "sobres", "otro"];

export function EmbotelladoDialog({ open, onOpenChange, bodegaId }: Props) {
  const [modo, setModo] = React.useState<Modo>("select");
  React.useEffect(() => { if (!open) setModo("select"); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modo !== "select" && (
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setModo("select")}>
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <Package className="size-5 text-state-vino" />
            {modo === "select" && "Nuevo embotellado"}
            {modo === "directo" && "Embotellar desde depósito"}
            {modo === "elaboracion" && "Elaboración propia"}
          </DialogTitle>
        </DialogHeader>

        {modo === "select" && <SelectMode onPick={setModo} />}
        {modo === "directo" && <DirectoForm bodegaId={bodegaId} onDone={() => onOpenChange(false)} />}
        {modo === "elaboracion" && <ElaboracionForm bodegaId={bodegaId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SelectMode({ onPick }: { onPick: (m: Modo) => void }) {
  const options = [
    { id: "directo" as const, icon: Wine, color: "var(--state-vino)", title: "Embotellar desde depósito",
      desc: "El vino ya está preparado en un depósito y se embotella directamente." },
    { id: "elaboracion" as const, icon: Beaker, color: "var(--accent)", title: "Elaboración propia",
      desc: "Mezcla vinos de varios depósitos y añade productos antes de embotellar." },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
      {options.map((o, i) => {
        const Icon = o.icon;
        return (
          <motion.button key={o.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }}
            onClick={() => onPick(o.id)}
            className="scada-panel p-5 text-left flex flex-col gap-3 hover:border-accent/60 transition-colors">
            <div className="size-12 rounded-xl flex items-center justify-center"
              style={{ background: `color-mix(in oklab, ${o.color} 18%, transparent)`,
                       border: `1px solid color-mix(in oklab, ${o.color} 40%, transparent)` }}>
              <Icon className="size-6" style={{ color: o.color }} />
            </div>
            <div>
              <div className="font-display font-semibold text-base">{o.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{o.desc}</div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ============ MODO DIRECTO ============
function DirectoForm({ bodegaId, onDone }: { bodegaId: string; onDone: () => void }) {
  const { zonas, depositos, updateDeposito } = useBodegaMap();
  const [zonaId, setZonaId] = React.useState<string>("");
  const [depositoId, setDepositoId] = React.useState<string>("");
  const [litros, setLitros] = React.useState("");
  const [formato, setFormato] = React.useState<string>("");
  const [botellas, setBotellas] = React.useState("");
  const [lote, setLote] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [fecha, setFecha] = React.useState<Date | undefined>();
  const [hora, setHora] = React.useState("");
  const [asign, setAsign] = React.useState<AsignadoSel[]>([]);

  const depsZona = depositos.filter((d) => !zonaId || d.zona_id === zonaId);
  const dep = depositos.find((d) => d.id === depositoId);
  const zona = zonas.find((z) => z.id === (dep?.zona_id ?? zonaId));

  // Autocalcular botellas
  React.useEffect(() => {
    const L = parseFloat(litros.replace(",", "."));
    const f = parseFloat((formato || "").replace(",", ".").replace(/[^\d.]/g, ""));
    if (L > 0 && f > 0) setBotellas(String(Math.floor(L / f)));
  }, [litros, formato]);

  const fn = useServerFn(crearEmbotelladoDirecto);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Embotellado registrado");
      // Restar litros al depósito local
      if (dep) {
        const L = parseFloat(litros.replace(",", "."));
        const nuevos = Math.max(0, dep.litros - L);
        updateDeposito(dep.id, { litros: nuevos });
      }
      qc.invalidateQueries({ queryKey: ["trabajos"] });
      qc.invalidateQueries({ queryKey: ["actividad"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!dep) return toast.error("Selecciona un depósito");
    const L = parseFloat(litros.replace(",", "."));
    if (!(L > 0)) return toast.error("Litros inválidos");
    if (!lote.trim()) return toast.error("Indica el lote de embotellado");
    m.mutate({ data: {
      bodegaId,
      deposito: dep.codigo,
      zona: zona?.nombre,
      litros: L,
      formato: formato || undefined,
      botellas: botellas ? Number(botellas) : undefined,
      lote: lote.trim(),
      observaciones: obs.trim() || undefined,
      scheduledAt: combineDateTime(fecha, hora),
      asignados: asign,
    }});
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Familia / Zona</Label>
          <Select value={zonaId} onValueChange={(v) => { setZonaId(v); setDepositoId(""); }}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {zonas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Depósito origen</Label>
          <Select value={depositoId} onValueChange={setDepositoId}>
            <SelectTrigger><SelectValue placeholder="Selecciona depósito" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {depsZona.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.codigo} · {d.litros.toLocaleString()}/{d.capacidad.toLocaleString()} L
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Litros a embotellar</Label>
          <Input type="number" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} />
        </div>
        <div>
          <Label>Formato</Label>
          <Select value={formato} onValueChange={setFormato}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {FORMATOS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nº botellas</Label>
          <Input type="number" value={botellas} onChange={(e) => setBotellas(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Lote de embotellado *</Label>
        <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="LB-2025-001" maxLength={120} />
      </div>

      <div>
        <Label>Observaciones</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={2000} />
      </div>

      <ProgramarYAsignar bodegaId={bodegaId} scheduledAt={fecha} onScheduledAtChange={setFecha}
        hora={hora} onHoraChange={setHora} asignados={asign} onAsignadosChange={setAsign} />

      <DialogFooter className="pt-3">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button onClick={submit} disabled={m.isPending}>{m.isPending ? "Guardando…" : "Registrar embotellado"}</Button>
      </DialogFooter>
    </div>
  );
}

// ============ MODO ELABORACIÓN ============
interface DepRow { uid: string; deposito_id: string; litros: string; variedad: string }
interface ProdRow { uid: string; producto_id: string; lote: string; cantidad: string; unidad: string; obs: string }

function ElaboracionForm({ bodegaId, onDone }: { bodegaId: string; onDone: () => void }) {
  const { zonas, depositos, updateDeposito } = useBodegaMap();
  const fnProd = useServerFn(listProductos);
  const productosQ = useQuery({
    queryKey: ["productos", bodegaId, "activos"],
    queryFn: () => fnProd({ data: { bodegaId, soloActivos: true } }),
  });

  const [nombre, setNombre] = React.useState("");
  const [lote, setLote] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [fecha, setFecha] = React.useState<Date | undefined>();
  const [hora, setHora] = React.useState("");
  const [asign, setAsign] = React.useState<AsignadoSel[]>([]);

  const [deps, setDeps] = React.useState<DepRow[]>([
    { uid: crypto.randomUUID(), deposito_id: "", litros: "", variedad: "" },
  ]);
  const [prods, setProds] = React.useState<ProdRow[]>([]);

  const addDep = () => setDeps((d) => [...d, { uid: crypto.randomUUID(), deposito_id: "", litros: "", variedad: "" }]);
  const rmDep = (uid: string) => setDeps((d) => d.filter((x) => x.uid !== uid));
  const setDep = (uid: string, patch: Partial<DepRow>) => setDeps((d) => d.map((x) => x.uid === uid ? { ...x, ...patch } : x));

  const addProd = () => setProds((p) => [...p, { uid: crypto.randomUUID(), producto_id: "", lote: "", cantidad: "", unidad: "g", obs: "" }]);
  const rmProd = (uid: string) => setProds((p) => p.filter((x) => x.uid !== uid));
  const setProd = (uid: string, patch: Partial<ProdRow>) =>
    setProds((p) => p.map((x) => x.uid === uid ? { ...x, ...patch } : x));

  const onPickProducto = (uid: string, productoId: string) => {
    const found = (productosQ.data ?? []).find((x: any) => x.id === productoId);
    setProd(uid, { producto_id: productoId, lote: found?.lote ?? "" });
  };

  const fn = useServerFn(crearElaboracionPropia);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Elaboración registrada");
      // Restar litros de cada depósito utilizado
      for (const row of deps) {
        const dep = depositos.find((d) => d.id === row.deposito_id);
        const L = parseFloat(row.litros.replace(",", "."));
        if (dep && L > 0) {
          updateDeposito(dep.id, { litros: Math.max(0, dep.litros - L) });
        }
      }
      qc.invalidateQueries({ queryKey: ["trabajos"] });
      qc.invalidateQueries({ queryKey: ["actividad"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!nombre.trim()) return toast.error("Indica el nombre de la elaboración");
    if (!lote.trim()) return toast.error("Indica el lote de embotellado");
    const depsPayload = deps.map((r) => {
      const dep = depositos.find((d) => d.id === r.deposito_id);
      const zona = zonas.find((z) => z.id === dep?.zona_id);
      return {
        deposito_codigo: dep?.codigo ?? "",
        zona: zona?.nombre,
        litros: parseFloat(r.litros.replace(",", ".")),
        variedad: r.variedad || dep?.contenido || undefined,
      };
    });
    if (depsPayload.some((d) => !d.deposito_codigo || !(d.litros > 0))) {
      return toast.error("Revisa los depósitos: faltan datos");
    }
    for (const p of prods) {
      if (!p.producto_id) return toast.error("Selecciona un producto del catálogo");
      if (!p.lote.trim()) return toast.error("Debes indicar el lote del producto para continuar.");
      if (!(parseFloat(p.cantidad.replace(",", ".")) > 0)) return toast.error("Cantidad de producto inválida");
    }

    m.mutate({ data: {
      bodegaId,
      nombre: nombre.trim(),
      fecha: fecha ? combineDateTime(fecha, hora) : undefined,
      lote_embotellado: lote.trim(),
      observaciones: obs.trim() || undefined,
      scheduledAt: combineDateTime(fecha, hora),
      asignados: asign,
      depositos: depsPayload,
      productos: prods.map((p) => ({
        producto_id: p.producto_id,
        lote: p.lote.trim(),
        cantidad: parseFloat(p.cantidad.replace(",", ".")),
        unidad: p.unidad,
        observaciones: p.obs || undefined,
      })),
    }});
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nombre de la elaboración *</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Coupage Reserva 2024" />
        </div>
        <div>
          <Label>Lote de embotellado *</Label>
          <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="LB-2025-002" />
        </div>
      </div>

      <div>
        <Label>Observaciones generales</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </div>

      {/* DEPÓSITOS */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Depósitos utilizados</Label>
          <Button variant="outline" size="sm" onClick={addDep}><Plus className="size-3 mr-1" />Añadir depósito</Button>
        </div>
        <div className="space-y-2">
          {deps.map((row) => {
            const dep = depositos.find((d) => d.id === row.deposito_id);
            const depsZona = depositos;
            return (
              <div key={row.uid} className="scada-panel p-3 grid grid-cols-[1fr_120px_1fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-[10px]">Depósito</Label>
                  <Select value={row.deposito_id} onValueChange={(v) => setDep(row.uid, { deposito_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {depsZona.map((d) => {
                        const z = zonas.find((z) => z.id === d.zona_id);
                        return (
                          <SelectItem key={d.id} value={d.id}>
                            {z?.corto ?? ""} · {d.codigo} ({d.litros.toLocaleString()} L)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Litros</Label>
                  <Input type="number" value={row.litros} onChange={(e) => setDep(row.uid, { litros: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[10px]">Variedad / contenido</Label>
                  <Input value={row.variedad} onChange={(e) => setDep(row.uid, { variedad: e.target.value })}
                    placeholder={dep?.contenido ?? "—"} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => rmDep(row.uid)} disabled={deps.length === 1}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRODUCTOS */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Productos utilizados</Label>
          <Button variant="outline" size="sm" onClick={addProd}><Plus className="size-3 mr-1" />Añadir producto</Button>
        </div>
        {(productosQ.data ?? []).length === 0 && (
          <div className="text-xs text-muted-foreground mb-2">
            No hay productos en el catálogo. Pide al administrador que los registre en Admin → Productos.
          </div>
        )}
        <div className="space-y-2">
          {prods.map((row) => (
            <div key={row.uid} className="scada-panel p-3 grid grid-cols-[2fr_1fr_1fr_100px_auto] gap-2 items-end">
              <div>
                <Label className="text-[10px]">Producto</Label>
                <Select value={row.producto_id} onValueChange={(v) => onPickProducto(row.uid, v)}>
                  <SelectTrigger><SelectValue placeholder="Selecciona del catálogo" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(productosQ.data ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} — Lote {p.lote}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Lote *</Label>
                <Input value={row.lote} onChange={(e) => setProd(row.uid, { lote: e.target.value })} />
              </div>
              <div>
                <Label className="text-[10px]">Cantidad</Label>
                <Input type="number" value={row.cantidad} onChange={(e) => setProd(row.uid, { cantidad: e.target.value })} />
              </div>
              <div>
                <Label className="text-[10px]">Unidad</Label>
                <Select value={row.unidad} onValueChange={(v) => setProd(row.uid, { unidad: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" onClick={() => rmProd(row.uid)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <ProgramarYAsignar bodegaId={bodegaId} scheduledAt={fecha} onScheduledAtChange={setFecha}
        hora={hora} onHoraChange={setHora} asignados={asign} onAsignadosChange={setAsign} />

      <DialogFooter className="pt-3">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button onClick={submit} disabled={m.isPending}>{m.isPending ? "Guardando…" : "Registrar elaboración"}</Button>
      </DialogFooter>
    </div>
  );
}
