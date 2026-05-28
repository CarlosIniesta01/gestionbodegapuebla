import { useMemo } from "react";
import { useColorSettings, variedadKey } from "@/lib/use-color-settings";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { ESTADO_META, getDepositoColor as baseGetDepositoColor, type DepositoEstado } from "@/lib/bodega-data";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

// Convert oklch() (or any CSS color) to hex via canvas for the <input type=color> value
function cssColorToHex(css: string): string {
  if (typeof document === "undefined") return "#888888";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(css)) {
    if (css.length === 4) {
      return "#" + css.slice(1).split("").map((c) => c + c).join("");
    }
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

  const variedades = useMemo(() => {
    const map = new Map<string, string>(); // key -> display name (first seen)
    for (const d of depositos) {
      if (d.contenido) {
        const k = variedadKey(d.contenido);
        if (!map.has(k)) map.set(k, d.contenido);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [depositos]);

  const estados: DepositoEstado[] = ["vacio", "mosto", "fermentacion", "vino", "limpieza", "trasiego", "incidencia"];

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Personalización</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Colores del mapa</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Elige el color que se usará en el mapa y en la lista para cada estado y cada variedad/contenido.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => colors.resetColors()}>
          <RotateCcw className="size-3.5 mr-1.5" /> Restablecer
        </Button>
      </header>

      <section className="scada-panel p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3">Estados</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {estados.map((e) => {
            const current = colors.getEstadoColor(e);
            const isOverride = colors.settings.estados[e] != null;
            return (
              <ColorRow
                key={e}
                label={ESTADO_META[e].label}
                current={current}
                isOverride={isOverride}
                onChange={(hex) => colors.setEstadoColor(e, hex)}
                onReset={() => colors.setEstadoColor(e, null)}
              />
            );
          })}
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
                <ColorRow
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

function ColorRow({
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
      <div
        className="size-9 rounded-md border border-border shrink-0"
        style={{ background: current }}
        aria-hidden="true"
      />
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
