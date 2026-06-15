import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Beaker, Plus, Pencil, Trash2, ArrowLeft, GlassWater, FlaskConical } from "lucide-react";

import {
  listPreparaciones,
  upsertPreparacion,
  deletePreparacion,
} from "@/lib/api/preparaciones.functions";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type VinoRow = { nombre: string; cantidad: string; unidad: "L" | "%" | "kg" | "hl"; notas?: string };
type ProdRow = { producto: string; dosis: string; unidad?: string; lote?: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bodegaId: string;
}

export function PreparacionesDialog({ open, onOpenChange, bodegaId }: Props) {
  const [mode, setMode] = React.useState<"list" | "edit">("list");
  const [editing, setEditing] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!open) {
      setMode("list");
      setEditing(null);
    }
  }, [open]);

  const listFn = useServerFn(listPreparaciones);
  const q = useQuery({
    queryKey: ["preparaciones", bodegaId],
    queryFn: () => listFn({ data: { bodegaId } }),
    enabled: open && !!bodegaId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "edit" && (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2"
                onClick={() => {
                  setMode("list");
                  setEditing(null);
                }}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <div
              className="size-9 rounded-lg flex items-center justify-center"
              style={{
                background: "color-mix(in oklab, var(--state-vino) 18%, transparent)",
                border: "1px solid color-mix(in oklab, var(--state-vino) 40%, transparent)",
              }}
            >
              <Beaker className="size-5" style={{ color: "var(--state-vino)" }} />
            </div>
            {mode === "list" ? "Preparaciones" : editing?.id ? "Editar preparación" : "Nueva preparación"}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <ListView
            loading={q.isLoading}
            items={q.data ?? []}
            bodegaId={bodegaId}
            onNew={() => {
              setEditing(null);
              setMode("edit");
            }}
            onEdit={(p) => {
              setEditing(p);
              setMode("edit");
            }}
          />
        ) : (
          <EditView
            bodegaId={bodegaId}
            preparacion={editing}
            onDone={() => {
              setMode("list");
              setEditing(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListView({
  loading,
  items,
  bodegaId,
  onNew,
  onEdit,
}: {
  loading: boolean;
  items: any[];
  bodegaId: string;
  onNew: () => void;
  onEdit: (p: any) => void;
}) {
  const delFn = useServerFn(deletePreparacion);
  const qc = useQueryClient();
  const delM = useMutation({
    mutationFn: delFn,
    onSuccess: () => {
      toast.success("Preparación eliminada");
      qc.invalidateQueries({ queryKey: ["preparaciones", bodegaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Crea coupages mezclando vinos y añade los productos enológicos necesarios.
        </div>
        <Button onClick={onNew} size="sm">
          <Plus className="size-4 mr-1" /> Nueva
        </Button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="scada-panel p-10 text-center text-muted-foreground">
          Aún no hay preparaciones. Crea la primera con el botón “Nueva”.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const vinos = Array.isArray(p.vinos) ? p.vinos : [];
            const prods = Array.isArray(p.productos) ? p.productos : [];
            return (
              <div key={p.id} className="scada-panel p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.nombre}</div>
                  {p.descripcion && (
                    <div className="text-xs text-muted-foreground truncate">{p.descripcion}</div>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <GlassWater className="size-3.5" /> {vinos.length} vino{vinos.length === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FlaskConical className="size-3.5" /> {prods.length} producto{prods.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {vinos.length > 0 && (
                    <div className="mt-2 text-xs flex flex-wrap gap-1">
                      {vinos.slice(0, 6).map((v: any, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md border border-border bg-muted/40"
                        >
                          {v.nombre}
                          {v.cantidad != null && v.cantidad !== "" ? ` · ${v.cantidad}${v.unidad ?? ""}` : ""}
                        </span>
                      ))}
                      {vinos.length > 6 && (
                        <span className="text-muted-foreground">+{vinos.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`¿Eliminar la preparación "${p.nombre}"?`)) {
                        delM.mutate({ data: { id: p.id } });
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditView({
  bodegaId,
  preparacion,
  onDone,
}: {
  bodegaId: string;
  preparacion: any | null;
  onDone: () => void;
}) {
  const [nombre, setNombre] = React.useState<string>(preparacion?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState<string>(preparacion?.descripcion ?? "");
  const [notas, setNotas] = React.useState<string>(preparacion?.notas ?? "");
  const [vinos, setVinos] = React.useState<VinoRow[]>(() => {
    const raw = Array.isArray(preparacion?.vinos) ? preparacion.vinos : [];
    if (!raw.length) return [{ nombre: "", cantidad: "", unidad: "L" }];
    return raw.map((v: any) => ({
      nombre: v.nombre ?? "",
      cantidad: v.cantidad == null ? "" : String(v.cantidad),
      unidad: (v.unidad as VinoRow["unidad"]) ?? "L",
      notas: v.notas ?? "",
    }));
  });
  const [productos, setProductos] = React.useState<ProdRow[]>(() => {
    const raw = Array.isArray(preparacion?.productos) ? preparacion.productos : [];
    if (!raw.length) return [{ producto: "", dosis: "", unidad: "g/hl", lote: "" }];
    return raw.map((p: any) => ({
      producto: p.producto ?? "",
      dosis: p.dosis == null ? "" : String(p.dosis),
      unidad: p.unidad ?? "g/hl",
      lote: p.lote ?? "",
    }));
  });

  const upFn = useServerFn(upsertPreparacion);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: upFn,
    onSuccess: () => {
      toast.success(preparacion?.id ? "Preparación actualizada" : "Preparación creada");
      qc.invalidateQueries({ queryKey: ["preparaciones", bodegaId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vinosLimpios = vinos
    .filter((v) => v.nombre.trim() || v.cantidad.trim())
    .map((v) => ({
      nombre: v.nombre.trim(),
      cantidad: v.cantidad === "" ? null : (Number.isFinite(Number(v.cantidad)) ? Number(v.cantidad) : null),
      unidad: v.unidad,
      notas: v.notas?.trim() || null,
    }))
    .filter((v) => v.nombre);

  const totalPct = vinosLimpios
    .filter((v) => v.unidad === "%")
    .reduce((acc, v) => acc + (typeof v.cantidad === "number" ? v.cantidad : 0), 0);
  const hayPct = vinosLimpios.some((v) => v.unidad === "%");
  const totalL = vinosLimpios
    .filter((v) => v.unidad === "L" || v.unidad === "hl")
    .reduce((acc, v) => acc + (typeof v.cantidad === "number" ? v.cantidad * (v.unidad === "hl" ? 100 : 1) : 0), 0);

  function submit() {
    if (!nombre.trim()) {
      toast.error("Indica un nombre para la preparación");
      return;
    }
    if (!vinosLimpios.length) {
      toast.error("Añade al menos un vino al coupage");
      return;
    }
    const prodsLimpios = productos
      .filter((p) => p.producto.trim() || p.dosis.trim() || p.lote?.trim())
      .map((p) => ({
        producto: p.producto.trim(),
        dosis: p.dosis === "" ? null : (Number.isFinite(Number(p.dosis)) ? Number(p.dosis) : null),
        unidad: p.unidad?.trim() || null,
        lote: p.lote?.trim() || null,
      }))
      .filter((p) => p.producto);

    m.mutate({
      data: {
        id: preparacion?.id,
        bodegaId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        vinos: vinosLimpios,
        productos: prodsLimpios,
        notas: notas.trim() || null,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Nombre</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Coupage Tinto 2025" maxLength={200} />
      </div>
      <div>
        <Label>Descripción</Label>
        <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} />
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Vinos del coupage</Label>
          <div className="text-xs text-muted-foreground">
            {hayPct ? `Σ % = ${totalPct.toFixed(1)}` : totalL > 0 ? `Σ ≈ ${totalL.toFixed(1)} L` : ""}
          </div>
        </div>
        <div className="space-y-2">
          {vinos.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_90px_auto] gap-2 items-end">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Vino</div>
                <Input
                  value={v.nombre}
                  onChange={(e) =>
                    setVinos((arr) => arr.map((x, idx) => (idx === i ? { ...x, nombre: e.target.value } : x)))
                  }
                  placeholder="Ej. Tempranillo D3"
                  maxLength={200}
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cantidad</div>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={v.cantidad}
                  onChange={(e) =>
                    setVinos((arr) => arr.map((x, idx) => (idx === i ? { ...x, cantidad: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unidad</div>
                <Select
                  value={v.unidad}
                  onValueChange={(u) =>
                    setVinos((arr) =>
                      arr.map((x, idx) => (idx === i ? { ...x, unidad: u as VinoRow["unidad"] } : x)),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="hl">hl</SelectItem>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVinos((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)))}
                disabled={vinos.length === 1}
                className="text-destructive hover:bg-destructive/10"
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVinos((arr) => [...arr, { nombre: "", cantidad: "", unidad: "L" }])}
          >
            + Añadir vino
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Label className="text-sm">Productos enológicos</Label>
        <div className="space-y-2">
          {productos.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_90px_1fr_auto] gap-2 items-end">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Producto</div>
                <Input
                  value={p.producto}
                  onChange={(e) =>
                    setProductos((arr) => arr.map((x, idx) => (idx === i ? { ...x, producto: e.target.value } : x)))
                  }
                  maxLength={200}
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dosis</div>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={p.dosis}
                  onChange={(e) =>
                    setProductos((arr) => arr.map((x, idx) => (idx === i ? { ...x, dosis: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unidad</div>
                <Input
                  value={p.unidad ?? ""}
                  onChange={(e) =>
                    setProductos((arr) => arr.map((x, idx) => (idx === i ? { ...x, unidad: e.target.value } : x)))
                  }
                  placeholder="g/hl"
                  maxLength={20}
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lote</div>
                <Input
                  value={p.lote ?? ""}
                  onChange={(e) =>
                    setProductos((arr) => arr.map((x, idx) => (idx === i ? { ...x, lote: e.target.value } : x)))
                  }
                  maxLength={100}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setProductos((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)))
                }
                disabled={productos.length === 1}
                className="text-destructive hover:bg-destructive/10"
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setProductos((arr) => [...arr, { producto: "", dosis: "", unidad: "g/hl", lote: "" }])
            }
          >
            + Añadir producto
          </Button>
        </div>
      </div>

      <div>
        <Label>Notas</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={2000} />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={m.isPending}>
          {m.isPending ? "Guardando…" : preparacion?.id ? "Guardar cambios" : "Crear preparación"}
        </Button>
      </DialogFooter>
    </div>
  );
}
