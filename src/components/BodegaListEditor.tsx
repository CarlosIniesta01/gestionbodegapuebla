import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { ESTADO_META, type Deposito, type Zona } from "@/lib/bodega-data";
import { useColorSettings } from "@/lib/use-color-settings";

import { EditZonaDialog } from "./EditZonaDialog";
import { EditDepositoDialog } from "./EditDepositoDialog";

const fmt = (n: number) => Number(n || 0).toLocaleString("es-ES");
export function BodegaListEditor() {
  const map = useBodegaMap();
  const colors = useColorSettings();



  const [query, setQuery] = useState("");
  const [zonaDialog, setZonaDialog] = useState<{ open: boolean; zona: Zona | null }>({ open: false, zona: null });
  const [depDialog, setDepDialog] = useState<{ open: boolean; deposito: Deposito | null; defaultZonaId?: string }>({ open: false, deposito: null });
  const [confirm, setConfirm] = useState<
    | { kind: "zona"; id: string; nombre: string; count: number }
    | { kind: "dep"; id: string; codigo: string }
    | null
  >(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return map.zonas.map((z) => {
      const deps = map.depositos
        .filter((d) => d.zona_id === z.id)
        .filter((d) => !q || d.codigo.toLowerCase().includes(q) || (d.contenido ?? "").toLowerCase().includes(q))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
      return { zona: z, deps };
    });
  }, [map.zonas, map.depositos, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar depósito, código o contenido…"
            className="w-full bg-background border border-input rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setZonaDialog({ open: true, zona: null })}
          className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
        >
          <Plus className="size-4" /> Nueva zona
        </button>
      </div>

      <div className="space-y-4">
        {grouped.map(({ zona, deps }) => (
          <section key={zona.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
            <header
              className="flex items-center justify-between px-4 py-3 border-b border-border"
              style={{ background: `color-mix(in oklab, ${zona.color} 8%, transparent)` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="size-3 rounded-full shrink-0" style={{ background: zona.color, boxShadow: `0 0 10px ${zona.color}` }} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{zona.nombre}</div>
                  <div className="text-[11px] text-muted-foreground">{deps.length} depósitos · prefijo {zona.corto}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDepDialog({ open: true, deposito: null, defaultZonaId: zona.id })}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary inline-flex items-center gap-1"
                >
                  <Plus className="size-3.5" /> Depósito
                </button>
                <button
                  onClick={() => setZonaDialog({ open: true, zona })}
                  className="size-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Editar zona"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => setConfirm({ kind: "zona", id: zona.id, nombre: zona.nombre, count: deps.length })}
                  className="size-8 rounded-lg hover:bg-destructive/15 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar zona"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </header>

            {deps.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Sin depósitos en esta zona.</div>
            ) : (
              <ul className="divide-y divide-border">
                {deps.map((d) => {
                  const meta = colors.getEstadoMeta(d.estado);

                  const pct = d.capacidad > 0 ? Math.min(100, (d.litros / d.capacidad) * 100) : 0;
                  return (
                    <li key={d.id} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[120px_1fr_auto_auto] items-center gap-3 px-4 py-2.5 hover:bg-secondary/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full shrink-0" style={{ background: meta.color }} />
                        <span className="font-mono text-sm font-medium truncate">{d.codigo}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground truncate">
                          {d.contenido ?? <span className="opacity-60">—</span>} · <span className="text-foreground/70">{meta.label}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 max-w-[200px] rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                            {fmt(d.litros)} / {fmt(d.capacidad)} L
                          </span>
                        </div>
                      </div>
                      <div className="hidden sm:block text-[11px] text-muted-foreground tabular-nums">
                        {Math.round(pct)}%
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setDepDialog({ open: true, deposito: d })}
                          className="size-7 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Editar depósito"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirm({ kind: "dep", id: d.id, codigo: d.codigo })}
                          className="size-7 rounded hover:bg-destructive/15 flex items-center justify-center text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar depósito"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No hay zonas todavía. Crea la primera para empezar.
          </div>
        )}
      </div>

      <EditZonaDialog
        open={zonaDialog.open}
        onOpenChange={(v) => setZonaDialog((s) => ({ ...s, open: v }))}
        zona={zonaDialog.zona}
        onSave={(data) => {
          if (zonaDialog.zona) map.updateZona(zonaDialog.zona.id, data);
          else map.addZona(data.nombre, data.corto, data.color);
        }}
      />

      <EditDepositoDialog
        open={depDialog.open}
        onOpenChange={(v) => setDepDialog((s) => ({ ...s, open: v }))}
        deposito={
          depDialog.deposito ??
          (depDialog.defaultZonaId
            ? ({ zona_id: depDialog.defaultZonaId } as Deposito)
            : null)
        }
        zonas={map.zonas}
        onSave={(data) => {
          if (depDialog.deposito) {
            map.updateDeposito(depDialog.deposito.id, data);
          } else {
            const id = map.addDeposito(data.zona_id, data.codigo, data.capacidad);
            map.updateDeposito(id, {
              litros: data.litros, estado: data.estado,
              contenido: data.contenido, radio: data.radio,
            });
          }
        }}
      />

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "zona" ? `Eliminar zona "${confirm.nombre}"` : `Eliminar depósito ${confirm?.kind === "dep" ? confirm.codigo : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "zona"
                ? `Se eliminarán también sus ${confirm.count} depósitos. Esta acción no se puede deshacer.`
                : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "zona") map.deleteZona(confirm.id);
                else map.deleteDeposito(confirm.id);
                setConfirm(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
