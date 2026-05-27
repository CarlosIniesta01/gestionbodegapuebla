import { createFileRoute } from "@tanstack/react-router";
import { DEPOSITOS, ESTADO_META, ZONAS } from "@/lib/bodega-data";

export const Route = createFileRoute("/bodega")({
  head: () => ({ meta: [{ title: "Bodega · Vinea Control" }] }),
  component: Bodega,
});

function Bodega() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Bodega</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Inventario de depósitos</h1>
      </header>

      {ZONAS.map((z) => {
        const items = DEPOSITOS.filter((d) => d.zona === z.id);
        return (
          <section key={z.id} className="scada-panel">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{z.corto}</div>
                <div className="font-display font-semibold">{z.nombre}</div>
              </div>
              <div className="text-xs text-muted-foreground">{items.length} depósitos</div>
            </div>
            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {items.map((d) => {
                const meta = ESTADO_META[d.estado];
                const pct = Math.round((d.litros / d.capacidad) * 100);
                return (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border border-border bg-background/40 hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-semibold">{d.id}</span>
                      <span className="size-2 rounded-full" style={{ background: meta.color }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{meta.label}</div>
                    <div className="text-xs tabular-nums">{pct}% · {(d.litros / 1000).toFixed(0)}k L</div>
                    <div className="h-1 mt-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
