import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Package } from "lucide-react";

import { listStockPorProducto } from "@/lib/api/lotes.functions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function StockTab({ bodegaId }: { bodegaId: string }) {
  const fn = useServerFn(listStockPorProducto);
  const q = useQuery({
    queryKey: ["stock", bodegaId],
    queryFn: () => fn({ data: { bodegaId } }),
  });
  const [filtro, setFiltro] = React.useState("");

  const rows = (q.data ?? []).filter((r: any) => {
    if (!filtro) return true;
    const f = filtro.toLowerCase();
    return r.nombre?.toLowerCase().includes(f) || r.categoria?.toLowerCase().includes(f);
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Buscar producto o categoría…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">
          Stock por producto ({rows.length})
        </div>
        {q.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Package className="size-8 mx-auto mb-2 opacity-50" />
            No hay productos con lotes registrados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/20 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Producto</th>
                <th className="text-left px-4 py-2">Categoría</th>
                <th className="text-right px-4 py-2">Stock</th>
                <th className="text-right px-4 py-2">Lotes</th>
                <th className="text-left px-4 py-2">Próx. caducidad</th>
                <th className="text-left px-4 py-2">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r: any) => {
                const stock = Number(r.stock_disponible ?? 0);
                const critico = r.stock_critico != null && stock <= Number(r.stock_critico);
                const minimo = !critico && r.stock_minimo != null && stock <= Number(r.stock_minimo);
                return (
                  <tr key={r.producto_id}>
                    <td className="px-4 py-2 font-medium">{r.nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.categoria ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{stock.toFixed(3)} {r.unidad}</td>
                    <td className="px-4 py-2 text-right">
                      {r.lotes_activos}
                      {Number(r.lotes_caducados) > 0 && (
                        <span className="text-rose-600 ml-1">+{r.lotes_caducados} cad.</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">{r.proxima_caducidad ?? "—"}</td>
                    <td className="px-4 py-2">
                      {critico && <Badge variant="outline" className="border-rose-500/50 text-rose-600"><AlertTriangle className="size-3 mr-1" />crítico</Badge>}
                      {minimo && <Badge variant="outline" className="border-amber-500/50 text-amber-600">bajo</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
