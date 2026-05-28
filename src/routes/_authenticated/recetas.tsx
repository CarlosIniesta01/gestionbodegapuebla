import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BookOpen, Plus, Search, Star, Copy, Trash2, Edit3, MoreVertical,
  Filter, PowerOff, Power, Droplets, Beaker, Sparkles,
} from "lucide-react";

import {
  listRecetas, toggleFavorita, toggleActiva, duplicarReceta, deleteReceta, listFamilias,
} from "@/lib/api/recetas.functions";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { RecetaEditorDialog } from "@/components/recetas/RecetaEditorDialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/recetas")({
  head: () => ({
    meta: [
      { title: "Recetas · Vinea Control" },
      { name: "description", content: "Biblioteca de recetas reutilizables para elaboraciones, productos y limpieza." },
    ],
  }),
  component: RecetasPage,
});

function RecetasPage() {
  const { bodegaId, isLoading: loadingBodega } = useActiveBodega();
  const qc = useQueryClient();
  const fnList = useServerFn(listRecetas);
  const fnFamilias = useServerFn(listFamilias);
  const fnFav = useServerFn(toggleFavorita);
  const fnAct = useServerFn(toggleActiva);
  const fnDup = useServerFn(duplicarReceta);
  const fnDel = useServerFn(deleteReceta);

  const listQ = useQuery({
    queryKey: ["recetas", bodegaId],
    queryFn: () => fnList({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });
  const familiasQ = useQuery({
    queryKey: ["recetas", "familias", bodegaId],
    queryFn: () => fnFamilias({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });

  const [search, setSearch] = React.useState("");
  const [familiaFilter, setFamiliaFilter] = React.useState<string | "all">("all");
  const [soloFavoritas, setSoloFavoritas] = React.useState(false);
  const [soloActivas, setSoloActivas] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recetas"] });

  const mFav = useMutation({ mutationFn: fnFav, onSuccess: invalidate });
  const mAct = useMutation({ mutationFn: fnAct, onSuccess: invalidate });
  const mDup = useMutation({
    mutationFn: fnDup,
    onSuccess: () => { toast.success("Receta duplicada"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: fnDel,
    onSuccess: () => { toast.success("Receta eliminada"); invalidate(); setConfirmDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    return (listQ.data ?? []).filter((r: any) => {
      if (soloActivas && !r.activa) return false;
      if (soloFavoritas && !r.favorita) return false;
      if (familiaFilter !== "all" && r.familia_id !== familiaFilter) return false;
      if (s) {
        const hay = [
          r.nombre, r.tipo, r.familia?.nombre, r.descripcion,
          ...(r.receta_productos ?? []).map((p: any) => `${p.productos?.nombre} ${p.lote}`),
          ...(r.receta_depositos ?? []).map((d: any) => d.deposito_codigo),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [listQ.data, search, familiaFilter, soloFavoritas, soloActivas]);

  if (loadingBodega) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  if (!bodegaId) return <div className="p-6 text-muted-foreground">No estás en ninguna bodega.</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Biblioteca</div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Recetas</h1>
          <p className="text-muted-foreground text-sm">Plantillas reutilizables para elaboraciones, productos y limpieza.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setEditorOpen(true); }} className="self-start md:self-auto">
          <Plus className="size-4 mr-1.5" /> Nueva receta
        </Button>
      </div>

      {/* Filters */}
      <div className="scada-panel p-3 mb-4 flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, producto, lote, depósito…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={familiaFilter === "all"} onClick={() => setFamiliaFilter("all")}>
            <Filter className="size-3 mr-1" /> Todas
          </FilterChip>
          {(familiasQ.data ?? []).map((f: any) => (
            <FilterChip
              key={f.id} active={familiaFilter === f.id}
              onClick={() => setFamiliaFilter(familiaFilter === f.id ? "all" : f.id)}
              color={f.color}
            >
              {f.nombre}
            </FilterChip>
          ))}
          <FilterChip active={soloFavoritas} onClick={() => setSoloFavoritas((v) => !v)}>
            <Star className={`size-3 mr-1 ${soloFavoritas ? "fill-yellow-400 text-yellow-400" : ""}`} /> Favoritas
          </FilterChip>
          <FilterChip active={!soloActivas} onClick={() => setSoloActivas((v) => !v)}>
            {soloActivas ? "Ver inactivas" : "Mostrar todas"}
          </FilterChip>
        </div>
      </div>

      {/* Grid */}
      {listQ.isLoading ? (
        <div className="text-muted-foreground p-10 text-center">Cargando recetas…</div>
      ) : filtered.length === 0 ? (
        <div className="scada-panel p-10 text-center text-muted-foreground">
          <BookOpen className="size-10 mx-auto mb-3 opacity-50" />
          {(listQ.data ?? []).length === 0
            ? "Aún no has creado ninguna receta. Pulsa “Nueva receta” para empezar."
            : "No hay resultados con los filtros actuales."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r: any) => (
            <RecetaCard
              key={r.id} receta={r}
              onEdit={() => { setEditingId(r.id); setEditorOpen(true); }}
              onToggleFav={() => mFav.mutate({ data: { id: r.id, favorita: !r.favorita } })}
              onToggleActiva={() => mAct.mutate({ data: { id: r.id, activa: !r.activa } })}
              onDuplicate={(asVersion) => mDup.mutate({ data: { id: r.id, comoNuevaVersion: asVersion } })}
              onDelete={() => setConfirmDelete(r.id)}
            />
          ))}
        </div>
      )}

      <RecetaEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        bodegaId={bodegaId}
        recetaId={editingId}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán todos los depósitos, productos y pasos asociados a esta versión.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && mDel.mutate({ data: { id: confirmDelete } })}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({ active, onClick, color, children }: {
  active?: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
      style={color && active ? { borderColor: color, color, background: `color-mix(in oklab, ${color} 12%, transparent)` } : undefined}
    >
      {color && !active && <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: color }} />}
      {children}
    </button>
  );
}

function RecetaCard({
  receta, onEdit, onToggleFav, onToggleActiva, onDuplicate, onDelete,
}: {
  receta: any;
  onEdit: () => void;
  onToggleFav: () => void;
  onToggleActiva: () => void;
  onDuplicate: (asVersion: boolean) => void;
  onDelete: () => void;
}) {
  const prods = receta.receta_productos ?? [];
  const deps = receta.receta_depositos ?? [];
  const lastUse = receta.ultimo_uso_at ? new Date(receta.ultimo_uso_at).toLocaleDateString("es-ES") : "Sin uso";

  return (
    <div className={`scada-panel p-4 flex flex-col gap-3 hover:border-primary/40 transition ${!receta.activa ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggleFav} className="mt-0.5" aria-label="Favorita">
          <Star className={`size-4 ${receta.favorita ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={onEdit} className="text-left w-full">
            <div className="font-medium text-sm truncate">{receta.nombre}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {receta.familia && (
                <Badge variant="outline" style={{ borderColor: receta.familia.color, color: receta.familia.color }}>
                  {receta.familia.nombre}
                </Badge>
              )}
              {receta.tipo && <span className="text-[11px] text-muted-foreground">{receta.tipo}</span>}
              {receta.version > 1 && <span className="text-[11px] text-muted-foreground">v{receta.version}</span>}
            </div>
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7"><MoreVertical className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Edit3 className="size-4 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(false)}><Copy className="size-4 mr-2" /> Duplicar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(true)}>
              <Copy className="size-4 mr-2" /> Nueva versión
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleActiva}>
              {receta.activa ? <><PowerOff className="size-4 mr-2" /> Desactivar</> : <><Power className="size-4 mr-2" /> Activar</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="size-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {prods.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {prods.slice(0, 3).map((p: any) => (
            <span key={p.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent/40 border border-border">
              <Beaker className="size-3" />
              {p.productos?.nombre ?? "—"}{p.dosis ? ` · ${p.dosis}${p.unidad}` : ""}
            </span>
          ))}
          {prods.length > 3 && <span className="text-[11px] text-muted-foreground">+{prods.length - 3}</span>}
        </div>
      )}

      {deps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {deps.slice(0, 4).map((d: any) => (
            <span key={d.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border">
              <Droplets className="size-3" />
              {d.deposito_codigo}
            </span>
          ))}
          {deps.length > 4 && <span className="text-[11px] text-muted-foreground">+{deps.length - 4}</span>}
        </div>
      )}

      <div className="border-t border-border pt-2 mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Sparkles className="size-3" /> {receta.uso_count ?? 0} usos</span>
        <span>Última: {lastUse}</span>
      </div>
    </div>
  );
}
