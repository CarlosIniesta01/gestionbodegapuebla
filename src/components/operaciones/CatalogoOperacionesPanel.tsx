import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, Search, Settings2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { useCatalogoOperaciones } from "./use-catalogo";
import {
  CAPACIDADES, ICONOS_FAMILIA, TIPO_FORMULARIO_LABEL, habilitadaEnCentro, iconoFamilia,
  type Familia, type Operacion,
} from "@/lib/operaciones-meta";
import {
  guardarFamilia, guardarOperacion, setActivoCatalogo, setOperacionCentro,
} from "@/lib/api/operaciones-catalogo.functions";

export function CatalogoOperacionesPanel() {
  const { bodegaId, bodegas, isGlobal } = useActiveBodega();
  const allIds = bodegas.map((b) => b.bodega_id);
  const q = useCatalogoOperaciones(allIds);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["catalogo-operaciones"] });

  const [centro, setCentro] = React.useState<string>(bodegaId ?? "");
  React.useEffect(() => { if (bodegaId && !isGlobal) setCentro(bodegaId); }, [bodegaId, isGlobal]);
  React.useEffect(() => { if (!centro && allIds[0]) setCentro(allIds[0]); }, [allIds, centro]);
  const [famFiltro, setFamFiltro] = React.useState("all");
  const [busca, setBusca] = React.useState("");
  const [config, setConfig] = React.useState(false);
  const [verInactivas, setVerInactivas] = React.useState(false);
  const [editFam, setEditFam] = React.useState<Partial<Familia> | null>(null);
  const [editOp, setEditOp] = React.useState<Partial<Operacion> | null>(null);

  const actFn = useServerFn(setActivoCatalogo);
  const cenFn = useServerFn(setOperacionCentro);
  const act = useMutation({ mutationFn: actFn, onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const cen = useMutation({ mutationFn: cenFn, onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });

  if (q.isLoading || !q.data) return <div className="p-4 text-sm text-muted-foreground">Cargando catálogo de operaciones…</div>;
  const { familias, operaciones, centro: cfg, permisos } = q.data;
  const p = permisos[centro] ?? {};
  const puedeConfig = !!(p["operaciones.catalogo.create"] || p["operaciones.catalogo.edit"] || p["operaciones.catalogo.disable"] || p["operaciones.centros.configure"]);
  const nombreCentro = (id: string) => bodegas.find((b) => b.bodega_id === id)?.bodega.nombre ?? "";

  const famVisibles = familias.filter((f) => (!f.bodega_id || f.bodega_id === centro) && (verInactivas || f.activo));
  const term = busca.trim().toLowerCase();
  const opsVisibles = operaciones.filter((o) =>
    (!o.bodega_id || o.bodega_id === centro) &&
    famVisibles.some((f) => f.id === o.familia_id) &&
    (famFiltro === "all" || o.familia_id === famFiltro) &&
    (verInactivas || o.activo) &&
    (!config ? habilitadaEnCentro(cfg, centro, o.id) || verInactivas : true) &&
    (!term || o.nombre.toLowerCase().includes(term) || o.codigo.toLowerCase().includes(term)));
  const puedeCrearTrabajo = !isGlobal && centro === bodegaId;

  return (
    <div className="rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
        <Layers className="size-4 text-muted-foreground" />
        <h3 className="text-[13px] font-semibold tracking-tight mr-auto">
          {config ? "Configuración de operaciones" : "Operaciones disponibles"}
        </h3>
        {puedeConfig && (
          <Button size="sm" variant={config ? "default" : "outline"} onClick={() => setConfig((v) => !v)}>
            <Settings2 className="size-4 mr-1" />{config ? "Salir de configuración" : "Configurar"}
          </Button>
        )}
      </div>

      <div className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={centro} onValueChange={setCentro}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Centro" /></SelectTrigger>
            <SelectContent>{bodegas.map((b) => <SelectItem key={b.bodega_id} value={b.bodega_id}>{b.bodega.nombre}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={famFiltro} onValueChange={setFamFiltro}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las familias</SelectItem>
              {famVisibles.map((f) => <SelectItem key={f.id} value={f.id}>{f.codigo} · {f.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Switch checked={verInactivas} onCheckedChange={setVerInactivas} />Mostrar inactivas/deshabilitadas
          </label>
          {config && (
            <div className="ml-auto flex gap-2">
              {p["operaciones.catalogo.create"] && <Button size="sm" variant="outline" onClick={() => setEditFam({ icono: "Layers", color: "#475569", orden: (familias.length + 1) * 10 })}><Plus className="size-4 mr-1" />Familia</Button>}
              {p["operaciones.catalogo.create"] && <Button size="sm" variant="outline" onClick={() => setEditOp({ familia_id: famFiltro !== "all" ? famFiltro : famVisibles[0]?.id, tipo_formulario: "operacion", requiere_operarios: true, orden: 0 })}><Plus className="size-4 mr-1" />Operación</Button>}
            </div>
          )}
        </div>

        {famVisibles.filter((f) => famFiltro === "all" || f.id === famFiltro).map((f) => {
          const ops = opsVisibles.filter((o) => o.familia_id === f.id);
          if (!ops.length && !config) return null;
          const Icon = iconoFamilia(f.icono);
          return (
            <div key={f.id} className="rounded-md border" style={{ borderColor: "var(--border)", opacity: f.activo ? 1 : 0.6 }}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                <Icon className="size-4" style={{ color: f.color }} />
                <span className="text-[11px] font-mono text-muted-foreground">{f.codigo}</span>
                <span className="text-[13px] font-semibold">{f.nombre}</span>
                {!f.activo && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}
                {f.bodega_id && <Badge variant="secondary" className="text-[10px]">Propia de {nombreCentro(f.bodega_id)}</Badge>}
                <span className="ml-auto text-[11px] text-muted-foreground">{ops.length} op.</span>
                {config && p["operaciones.catalogo.edit"] && <Button size="icon" variant="ghost" className="size-7" aria-label="Editar familia" onClick={() => setEditFam(f)}><Pencil className="size-3.5" /></Button>}
                {config && p["operaciones.catalogo.disable"] && (
                  <Switch aria-label="Familia activa" checked={f.activo}
                    onCheckedChange={(v) => act.mutate({ data: { bodegaId: centro, tabla: "familia", id: f.id, activo: v } })} />
                )}
              </div>
              <ul className="divide-y">
                {ops.map((o) => {
                  const hab = habilitadaEnCentro(cfg, centro, o.id);
                  return (
                    <li key={o.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-[12px]" style={{ opacity: o.activo && hab ? 1 : 0.6 }}>
                      <span className="font-mono text-[10px] text-muted-foreground w-14">{o.codigo}</span>
                      <span className="font-medium">{o.nombre}</span>
                      <span className="text-[10px] text-muted-foreground">{TIPO_FORMULARIO_LABEL[o.tipo_formulario]}</span>
                      {!o.activo && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}
                      {o.activo && !hab && <Badge variant="outline" className="text-[10px]">Deshabilitada en el centro</Badge>}
                      <div className="flex flex-wrap gap-1 basis-full sm:basis-auto sm:ml-2">
                        {CAPACIDADES.filter((c) => o[c.key]).map((c) => <span key={c.key} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{c.label}</span>)}
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        {config ? (
                          <>
                            {p["operaciones.centros.configure"] && (
                              <label className="flex items-center gap-1 text-[11px]">
                                <Switch checked={hab} onCheckedChange={(v) => cen.mutate({ data: { bodegaId: centro, operacionIds: [o.id], habilitada: v } })} />En centro
                              </label>
                            )}
                            {p["operaciones.catalogo.disable"] && (
                              <label className="flex items-center gap-1 text-[11px]">
                                <Switch checked={o.activo} onCheckedChange={(v) => act.mutate({ data: { bodegaId: centro, tabla: "operacion", id: o.id, activo: v } })} />Activa
                              </label>
                            )}
                            {p["operaciones.catalogo.edit"] && <Button size="icon" variant="ghost" className="size-7" aria-label="Editar operación" onClick={() => setEditOp(o)}><Pencil className="size-3.5" /></Button>}
                          </>
                        ) : puedeCrearTrabajo && o.activo && hab ? (
                          <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                            <Link to="/trabajos" search={{ op: o.id }}>Crear trabajo</Link>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {o_desc(f)}
            </div>
          );
        })}
        {!puedeCrearTrabajo && !config && (
          <div className="text-[11px] text-muted-foreground">Para crear trabajos, selecciona como centro activo el centro consultado.</div>
        )}
      </div>

      {editFam && <FamiliaDialog value={editFam} bodegaId={centro} onClose={() => setEditFam(null)} onSaved={refresh} />}
      {editOp && <OperacionDialog value={editOp} familias={famVisibles} bodegaId={centro} onClose={() => setEditOp(null)} onSaved={refresh} />}
    </div>
  );
}

function o_desc(f: Familia) {
  return f.descripcion ? <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t">{f.descripcion}</div> : null;
}

function FamiliaDialog({ value, bodegaId, onClose, onSaved }: { value: Partial<Familia>; bodegaId: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState<Partial<Familia>>(value);
  const fn = useServerFn(guardarFamilia);
  const m = useMutation({ mutationFn: fn, onSuccess: () => { toast.success("Familia guardada"); onSaved(); onClose(); }, onError: (e: Error) => toast.error(e.message) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{v.id ? "Editar familia" : "Nueva familia"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Código</Label><Input value={v.codigo ?? ""} onChange={(e) => setV({ ...v, codigo: e.target.value.toUpperCase() })} placeholder="F19" /></div>
          <div><Label>Orden</Label><Input type="number" value={v.orden ?? 0} onChange={(e) => setV({ ...v, orden: Number(e.target.value) })} /></div>
          <div className="col-span-2"><Label>Nombre</Label><Input value={v.nombre ?? ""} onChange={(e) => setV({ ...v, nombre: e.target.value })} /></div>
          <div className="col-span-2"><Label>Descripción</Label><Textarea rows={2} value={v.descripcion ?? ""} onChange={(e) => setV({ ...v, descripcion: e.target.value })} /></div>
          <div><Label>Icono</Label>
            <Select value={v.icono ?? "Layers"} onValueChange={(x) => setV({ ...v, icono: x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(ICONOS_FAMILIA).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Color</Label><Input type="color" value={v.color ?? "#475569"} onChange={(e) => setV({ ...v, color: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={m.isPending || !v.codigo || !v.nombre} onClick={() => m.mutate({ data: {
            bodegaId, id: v.id, codigo: v.codigo!, nombre: v.nombre!, descripcion: v.descripcion ?? null,
            icono: v.icono ?? "Layers", color: v.color ?? "#475569", orden: v.orden ?? 0,
          } })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OperacionDialog({ value, familias, bodegaId, onClose, onSaved }: { value: Partial<Operacion>; familias: Familia[]; bodegaId: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState<Partial<Operacion>>(value);
  const fn = useServerFn(guardarOperacion);
  const m = useMutation({ mutationFn: fn, onSuccess: () => { toast.success("Operación guardada"); onSaved(); onClose(); }, onError: (e: Error) => toast.error(e.message) });
  const caps = Object.fromEntries(CAPACIDADES.map((c) => [c.key, !!v[c.key]]));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{v.id ? "Editar operación" : "Nueva operación"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Familia</Label>
            <Select value={v.familia_id ?? ""} onValueChange={(x) => setV({ ...v, familia_id: x })}>
              <SelectTrigger><SelectValue placeholder="Familia" /></SelectTrigger>
              <SelectContent>{familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.codigo} · {f.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Código</Label><Input value={v.codigo ?? ""} onChange={(e) => setV({ ...v, codigo: e.target.value.toUpperCase() })} placeholder="F06-11" /></div>
          <div><Label>Orden</Label><Input type="number" value={v.orden ?? 0} onChange={(e) => setV({ ...v, orden: Number(e.target.value) })} /></div>
          <div className="col-span-2"><Label>Nombre</Label><Input value={v.nombre ?? ""} onChange={(e) => setV({ ...v, nombre: e.target.value })} /></div>
          <div className="col-span-2"><Label>Descripción</Label><Textarea rows={2} value={v.descripcion ?? ""} onChange={(e) => setV({ ...v, descripcion: e.target.value })} /></div>
          <div className="col-span-2"><Label>Formulario que abre</Label>
            <Select value={v.tipo_formulario ?? "operacion"} onValueChange={(x) => setV({ ...v, tipo_formulario: x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_FORMULARIO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Capacidades (solo descriptivas en esta fase)</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {CAPACIDADES.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-[12px]">
                  <Checkbox checked={!!v[c.key]} onCheckedChange={(x) => setV({ ...v, [c.key]: !!x })} />{c.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={m.isPending || !v.codigo || !v.nombre || !v.familia_id} onClick={() => m.mutate({ data: {
            bodegaId, id: v.id, familia_id: v.familia_id!, codigo: v.codigo!, nombre: v.nombre!,
            descripcion: v.descripcion ?? null, orden: v.orden ?? 0, tipo_formulario: (v.tipo_formulario ?? "operacion") as any,
            ...(caps as any),
          } })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
