import { useMemo, useState } from "react";
import { useColorSettings, variedadKey } from "@/lib/use-color-settings";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { BUILTIN_ESTADOS, getDepositoColor as baseGetDepositoColor } from "@/lib/bodega-data";
import { Button } from "@/components/ui/button";
import { Plus, RotateCcw, Trash2, Eye } from "lucide-react";

// Convert oklch() (or any CSS color) to hex via canvas for the <input type=color> value
function cssColorToHex(css: string): string {
  if (typeof document === "undefined") return "#888888";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(css)) {
    if (css.length === 4) return "#" + css.slice(1).split("").map((c) => c + c).join("");
    return css;
  }
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return "#888888";
  try {
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    const computed = ctx.fillStyle as string;
    if (/^#/.test(computed)) return computed;
    const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) {
      const [, r, g, b] = m;
      return "#" + [r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
    }
  } catch { /* ignore */ }
  return "#888888";
}

export function ColorSettings() {
  const colors = useColorSettings();
  const { depositos } = useBodegaMap();
  const estados = colors.getAllEstados();
  const hidden = colors.settings.hiddenBuiltins;

  const variedades = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of depositos) {
      if (d.contenido) {
        const k = variedadKey(d.contenido);
        if (!map.has(k)) map.set(k, d.contenido);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [depositos]);

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#7dd3fc");

  const usageCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of depositos) c[d.estado] = (c[d.estado] ?? 0) + 1;
    return c;
  }, [depositos]);

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Personalización</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Estados y colores</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Añade, renombra, oculta o cambia el color de los estados de los depósitos.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => colors.resetColors()}>
          <RotateCcw className="size-3.5 mr-1.5" /> Restablecer
        </Button>
      </header>

      <section className="scada-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Estados disponibles</div>
          <span className="text-[11px] text-muted-foreground">{estados.length} activos</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {estados.map((e) => {
            const isBuiltin = (BUILTIN_ESTADOS as readonly string[]).includes(e.key);
            const colorOverride = colors.settings.estados[e.key] != null;
            const labelOverride = colors.settings.labels[e.key] != null;
            return (
              <EstadoRow
                key={e.key}
                label={e.label}
                color={e.color}
                badge={isBuiltin ? "Base" : "Personalizado"}
                usage={usageCount[e.key] ?? 0}
                hasOverride={colorOverride || labelOverride}
                onLabelChange={(v) => colors.setEstadoLabel(e.key, v || null)}
                onColorChange={(hex) => colors.setEstadoColor(e.key, hex)}
                onReset={() => {
                  colors.setEstadoColor(e.key, null);
                  colors.setEstadoLabel(e.key, null);
                }}
                onRemove={() => colors.removeEstado(e.key)}
                removeLabel={isBuiltin ? "Ocultar" : "Eliminar"}
              />
            );
          })}
        </div>

        {hidden.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Estados base ocultos</div>
            <div className="flex flex-wrap gap-1.5">
              {hidden.map((k) => (
                <button
                  key={k}
                  onClick={() => colors.restoreBuiltin(k)}
                  className="px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1"
                >
                  <Eye className="size-3" /> {k}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Añadir estado nuevo
          </div>
          <div className="flex items-center gap-2">
            <label className="relative cursor-pointer size-9 rounded-md border border-border overflow-hidden shrink-0" title="Color">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-full h-full" style={{ background: newColor }} />
            </label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nombre del estado (ej. Crianza)"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) {
                  colors.addCustomEstado(newLabel, newColor);
                  setNewLabel("");
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!newLabel.trim()) return;
                colors.addCustomEstado(newLabel, newColor);
                setNewLabel("");
              }}
            >
              <Plus className="size-3.5 mr-1" /> Añadir
            </Button>
          </div>
        </div>
      </section>

      <section className="scada-panel p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3">
          Variedades / contenidos en la bodega
        </div>
        {variedades.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay depósitos con contenido todavía.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {variedades.map(([k, display]) => {
              const override = colors.settings.variedades[k];
              const current = override ?? baseGetDepositoColor({ estado: "vino", contenido: display });
              return (
                <SimpleColorRow
                  key={k}
                  label={display}
                  current={current}
                  isOverride={override != null}
                  onChange={(hex) => colors.setVariedadColor(display, hex)}
                  onReset={() => colors.setVariedadColor(display, null)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EstadoRow({
  label, color, badge, usage, hasOverride,
  onLabelChange, onColorChange, onReset, onRemove, removeLabel,
}: {
  label: string;
  color: string;
  badge: string;
  usage: number;
  hasOverride: boolean;
  onLabelChange: (v: string) => void;
  onColorChange: (hex: string) => void;
  onReset: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const hex = cssColorToHex(color);
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
      <label className="relative cursor-pointer size-9 rounded-md border border-border overflow-hidden shrink-0" title="Elegir color">
        <input
          type="color"
          value={hex}
          onChange={(e) => onColorChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-full h-full" style={{ background: color }} />
      </label>
      <div className="flex-1 min-w-0 space-y-1">
        <input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="w-full bg-transparent text-sm font-medium focus:outline-none focus:bg-background rounded px-1 -mx-1"
        />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-background border border-border">{badge}</span>
          <span>{usage} depósito{usage === 1 ? "" : "s"}</span>
        </div>
      </div>
      {hasOverride && (
        <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0" title="Restablecer">
          <RotateCcw className="size-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        title={removeLabel}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function SimpleColorRow({
  label, current, isOverride, onChange, onReset,
}: {
  label: string;
  current: string;
  isOverride: boolean;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  const hex = cssColorToHex(current);
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
      <div className="size-9 rounded-md border border-border shrink-0" style={{ background: current }} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground font-mono">{hex}</div>
      </div>
      <label className="relative cursor-pointer size-9 rounded-md border border-border overflow-hidden shrink-0" title="Elegir color">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-full h-full" style={{ background: hex }} />
      </label>
      {isOverride && (
        <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0">
          <RotateCcw className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
