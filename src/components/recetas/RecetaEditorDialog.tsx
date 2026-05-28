import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Star, Save, GitBranch, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

import { listFamilias, upsertFamilia, upsertReceta, getReceta } from "@/lib/api/recetas.functions";
import { listProductos } from "@/lib/api/productos.functions";
import { useBodegaMap } from "@/lib/use-bodega-map";

const UNIDADES = ["g", "kg", "ml", "L", "sobres", "otro"];
const TIPOS = ["Tinto", "Blanco", "Rosado", "Mosto", "Limpieza", "General"];

interface DepRow {
  zona_id: string;
  deposito_codigo: string;
  litros: string;
  variedad: string;
  observaciones: string;
}
interface ProdRow {
  producto_id: string;
  dosis: string;
  unidad: string;
  lote: string;
  observaciones: string;
}
interface PasoRow {
  texto: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
  recetaId?: string | null;
}

export function RecetaEditorDialog({ open, onOpenChange, bodegaId, recetaId }: Props) {
  const qc = useQueryClient();
  const { zonas, depositos } = useBodegaMap();
  const fnFamilias = useServerFn(listFamilias);
  const fnUpsertFamilia = useServerFn(upsertFamilia);
  const fnProductos = useServerFn(listProductos);
  const fnUpsert = useServerFn(upsertReceta);
  const fnGet = useServerFn(getReceta);

  const familiasQ = useQuery({
    queryKey: ["recetas", "familias", bodegaId],
    queryFn: () => fnFamilias({ data: { bodegaId } }),
    enabled: open,
  });
  const productosQ = useQuery({
    queryKey: ["productos", bodegaId, true],
    queryFn: () => fnProductos({ data: { bodegaId, soloActivos: true } }),
    enabled: open,
  });
  const detailQ = useQuery({
    queryKey: ["receta", recetaId],
    queryFn: () => fnGet({ data: { id: recetaId! } }),
    enabled: open && !!recetaId,
  });

  const [nombre, setNombre] = React.useState("");
  const [familiaId, setFamiliaId] = React.useState<string>("");
  const [tipo, setTipo] = React.useState<string>("");
  const [descripcion, setDescripcion] = React.useState("");
  const [observaciones, setObservaciones] = React.useState("");
  const [activa, setActiva] = React.useState(true);
  const [favorita, setFavorita] = React.useState(false);
  const [deps, setDeps] = React.useState<DepRow[]>([]);
  const [prods, setProds] = React.useState<ProdRow[]>([]);
  const [pasos, setPasos] = React.useState<PasoRow[]>([]);

  // Hydrate when opening
  React.useEffect(() => {
    if (!open) return;
    if (recetaId && detailQ.data) {
      const r: any = detailQ.data;
      setNombre(r.nombre);
      setFamiliaId(r.familia_id ?? "");
      setTipo(r.tipo ?? "");
      setDescripcion(r.descripcion ?? "");
      setObservaciones(r.observaciones ?? "");
      setActiva(r.activa);
      setFavorita(r.favorita);
      setDeps((r.receta_depositos ?? []).sort((a: any, b: any) => a.orden - b.orden).map((d: any) => ({
        zona_id: d.zona_id ?? "", deposito_codigo: d.deposito_codigo, litros: d.litros?.toString() ?? "",
        variedad: d.variedad ?? "", observaciones: d.observaciones ?? "",
      })));
      setProds((r.receta_productos ?? []).sort((a: any, b: any) => a.orden - b.orden).map((p: any) => ({
        producto_id: p.producto_id, dosis: p.dosis?.toString() ?? "", unidad: p.unidad,
        lote: p.lote, observaciones: p.observaciones ?? "",
      })));
      setPasos((r.receta_pasos ?? []).sort((a: any, b: any) => a.orden - b.orden).map((p: any) => ({ texto: p.texto })));
    } else if (!recetaId) {
      setNombre(""); setFamiliaId(""); setTipo(""); setDescripcion(""); setObservaciones("");
      setActiva(true); setFavorita(false); setDeps([]); setProds([]); setPasos([]);
    }
  }, [open, recetaId, detailQ.data]);

  const mUpsert = useMutation({
    mutationFn: fnUpsert,
    onSuccess: () => {
      toast.success(recetaId ? "Receta guardada" : "Receta creada");
      qc.invalidateQueries({ queryKey: ["recetas"] });
      qc.invalidateQueries({ queryKey: ["receta", recetaId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mNewFamilia = useMutation({
    mutationFn: fnUpsertFamilia,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["recetas", "familias", bodegaId] });
      setFamiliaId(r.id);
      toast.success("Familia creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addDep() {
    setDeps((d) => [...d, { zona_id: "", deposito_codigo: "", litros: "", variedad: "", observaciones: "" }]);
  }
  function addProd() {
    setProds((p) => [...p, { producto_id: "", dosis: "", unidad: "g", lote: "", observaciones: "" }]);
  }

  function submit(comoNuevaVersion = false) {
    if (!nombre.trim()) return toast.error("Pon un nombre a la receta");
    // Validar lotes
    for (const p of prods) {
      if (!p.producto_id) return toast.error("Selecciona el producto en todas las filas");
      if (!p.lote.trim()) return toast.error("Debes indicar el lote del producto para continuar.");
    }
    for (const d of deps) {
      if (!d.deposito_codigo) return toast.error("Selecciona el depósito en todas las filas");
    }

    mUpsert.mutate({
      data: {
        id: recetaId ?? undefined,
        bodegaId,
        nombre: nombre.trim(),
        familia_id: familiaId || null,
        tipo: tipo || null,
        descripcion: descripcion.trim() || null,
        observaciones: observaciones.trim() || null,
        activa,
        favorita,
        depositos: deps.map((d) => ({
          zona_id: d.zona_id || null,
          deposito_codigo: d.deposito_codigo,
          litros: d.litros ? Number(d.litros.replace(/\./g, "").replace(",", ".")) : null,
          variedad: d.variedad || null,
          observaciones: d.observaciones || null,
        })),
        productos: prods.map((p) => ({
          producto_id: p.producto_id,
          dosis: p.dosis ? Number(p.dosis.replace(",", ".")) : null,
          unidad: p.unidad as any,
          lote: p.lote.trim(),
          observaciones: p.observaciones || null,
        })),
        pasos: pasos.filter((p) => p.texto.trim()).map((p) => ({ texto: p.texto.trim() })),
        comoNuevaVersion,
      },
    });
  }

  function onProductoChange(idx: number, productoId: string) {
    const prod = (productosQ.data ?? []).find((p: any) => p.id === productoId);
    setProds((arr) =>
      arr.map((row, i) => (i === idx ? { ...row, producto_id: productoId, lote: row.lote || prod?.lote || "" } : row)),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {recetaId ? "Editar receta" : "Nueva receta"}
            <button
              type="button"
              onClick={() => setFavorita((v) => !v)}
              className="ml-auto"
              aria-label="Marcar favorita"
            >
              <Star
                className={`size-5 ${favorita ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
              />
            </button>
          </DialogTitle>
        </DialogHeader>

        {/* General */}
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={160} placeholder="Ej. Clarificación tinto reserva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Familia / categoría</Label>
              <div className="flex gap-2">
                <Select value={familiaId || "__none"} onValueChange={(v) => setFamiliaId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sin familia —</SelectItem>
                    {(familiasQ.data ?? []).map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="inline-block size-2 rounded-full mr-2" style={{ background: f.color }} />
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button" variant="outline" size="icon"
                  onClick={() => {
                    const nombre = window.prompt("Nombre de la familia:");
                    if (nombre?.trim()) {
                      mNewFamilia.mutate({ data: { bodegaId, nombre: nombre.trim(), color: "#8b5cf6" } });
                    }
                  }}
                  title="Nueva familia"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo || "__none"} onValueChange={(v) => setTipo(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Sin tipo —</SelectItem>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} />
          </div>
        </div>

        {/* Depósitos */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Depósitos previstos</div>
            <Button size="sm" variant="outline" onClick={addDep}><Plus className="size-3.5 mr-1" /> Añadir</Button>
          </div>
          {deps.length === 0 && <p className="text-xs text-muted-foreground">Sin depósitos.</p>}
          {deps.map((d, i) => {
            const depsZona = depositos.filter((x) => x.zona_id === d.zona_id);
            return (
              <div key={i} className="rounded-md border border-border p-2 space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <Select value={d.zona_id || "__none"} onValueChange={(v) => {
                      const z = v === "__none" ? "" : v;
                      setDeps((arr) => arr.map((r, j) => j === i ? { ...r, zona_id: z, deposito_codigo: "" } : r));
                    }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Zona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Zona —</SelectItem>
                        {zonas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Select
                      value={d.deposito_codigo || "__none"}
                      onValueChange={(v) => setDeps((arr) => arr.map((r, j) => j === i ? { ...r, deposito_codigo: v === "__none" ? "" : v } : r))}
                      disabled={!d.zona_id}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder={d.zona_id ? "Depósito" : "Elige zona"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Ninguno —</SelectItem>
                        {depsZona.sort((a, b) => a.codigo.localeCompare(b.codigo)).map((x) => (
                          <SelectItem key={x.id} value={x.codigo}>{x.codigo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      className="h-9" placeholder="Litros" inputMode="numeric"
                      value={d.litros}
                      onChange={(e) => setDeps((arr) => arr.map((r, j) => j === i ? { ...r, litros: e.target.value } : r))}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-9" onClick={() => setDeps((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8" placeholder="Variedad (opcional)" value={d.variedad}
                    onChange={(e) => setDeps((arr) => arr.map((r, j) => j === i ? { ...r, variedad: e.target.value } : r))} />
                  <Input className="h-8" placeholder="Observaciones" value={d.observaciones}
                    onChange={(e) => setDeps((arr) => arr.map((r, j) => j === i ? { ...r, observaciones: e.target.value } : r))} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Productos */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Productos</div>
            <Button size="sm" variant="outline" onClick={addProd}><Plus className="size-3.5 mr-1" /> Añadir</Button>
          </div>
          {(productosQ.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay productos activos. Créalos en <strong>Admin · Productos</strong>.
            </p>
          )}
          {prods.length === 0 && <p className="text-xs text-muted-foreground">Sin productos.</p>}
          {prods.map((p, i) => (
            <div key={i} className="rounded-md border border-border p-2 space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Select value={p.producto_id || "__none"} onValueChange={(v) => v !== "__none" && onProductoChange(i, v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Producto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Selecciona —</SelectItem>
                      {(productosQ.data ?? []).map((x: any) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.nombre} {x.lote ? <span className="text-muted-foreground text-xs">· lote {x.lote}</span> : null}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input className="h-9" placeholder="Dosis" inputMode="decimal" value={p.dosis}
                    onChange={(e) => setProds((arr) => arr.map((r, j) => j === i ? { ...r, dosis: e.target.value } : r))} />
                </div>
                <div className="col-span-2">
                  <Select value={p.unidad} onValueChange={(v) => setProds((arr) => arr.map((r, j) => j === i ? { ...r, unidad: v } : r))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input className="h-9" placeholder="Lote *" value={p.lote}
                    onChange={(e) => setProds((arr) => arr.map((r, j) => j === i ? { ...r, lote: e.target.value } : r))} />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" className="h-9" onClick={() => setProds((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <Input className="h-8" placeholder="Observaciones (opcional)" value={p.observaciones}
                onChange={(e) => setProds((arr) => arr.map((r, j) => j === i ? { ...r, observaciones: e.target.value } : r))} />
            </div>
          ))}
        </div>

        {/* Pasos */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Pasos / instrucciones</div>
            <Button size="sm" variant="outline" onClick={() => setPasos((p) => [...p, { texto: "" }])}>
              <Plus className="size-3.5 mr-1" /> Añadir
            </Button>
          </div>
          {pasos.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Badge variant="outline" className="h-9 px-2 flex items-center">{i + 1}</Badge>
              <Input value={p.texto} onChange={(e) => setPasos((arr) => arr.map((r, j) => j === i ? { texto: e.target.value } : r))} />
              <Button variant="ghost" size="icon" onClick={() => setPasos((arr) => arr.filter((_, j) => j !== i))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* Observaciones generales + activa */}
        <div className="border-t border-border pt-3 space-y-2">
          <Label>Observaciones generales</Label>
          <Textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={2000} />
          <div className="flex items-center justify-between pt-1">
            <Label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={activa} onCheckedChange={setActiva} />
              {activa ? "Activa" : "Inactiva"}
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {recetaId && (
            <Button variant="outline" onClick={() => submit(true)} disabled={mUpsert.isPending}>
              <GitBranch className="size-4 mr-1.5" /> Guardar como nueva versión
            </Button>
          )}
          <Button onClick={() => submit(false)} disabled={mUpsert.isPending}>
            {mUpsert.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
