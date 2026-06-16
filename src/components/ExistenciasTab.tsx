import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExistencias } from "@/lib/api/movimientos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";
import { useBodegaMap } from "@/lib/use-bodega-map";

interface Props { bodegaId: string }

export function ExistenciasTab({ bodegaId }: Props) {
  const listE = useServerFn(listExistencias);
  const listP = useServerFn(listProductosComerciales);
  const { depositos } = useBodegaMap(bodegaId);

  const eQ = useQuery({
    queryKey: ["existencias", bodegaId],
    queryFn: () => listE({ data: { bodegaId } }),
  });
  const pQ = useQuery({
    queryKey: ["productos-comerciales", bodegaId],
    queryFn: () => listP({ data: { bodegaId } }),
  });
  const existencias = (eQ.data ?? []) as any[];
  const productos = (pQ.data ?? []) as any[];

  const prodById = useMemo(() => Object.fromEntries(productos.map((p) => [p.id, p])), [productos]);
  const depById = useMemo(() => Object.fromEntries(depositos.map((d) => [d.id, d])), [depositos]);

  const porProducto = useMemo(() => {
    const m: Record<string, { litros: number; aa: number; nombre: string; codigo: string }> = {};
    existencias.forEach((e) => {
      const key = e.producto_id ?? "__sin__";
      const p = e.producto_id ? prodById[e.producto_id] : null;
      m[key] = m[key] ?? { litros: 0, aa: 0, nombre: p?.nombre ?? "(sin producto)", codigo: p?.codigo ?? "—" };
      m[key].litros += Number(e.litros);
      m[key].aa += Number(e.alcohol_absoluto);
    });
    return Object.values(m).sort((a, b) => b.litros - a.litros);
  }, [existencias, prodById]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-display mb-2">Existencias por producto</h3>
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="text-left p-2">Código</th>
                <th className="text-left p-2">Producto</th>
                <th className="text-right p-2">Litros</th>
                <th className="text-right p-2">Alc. absoluto</th>
              </tr>
            </thead>
            <tbody>
              {porProducto.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{r.codigo}</td>
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2 text-right tabular-nums">{r.litros.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                  <td className="p-2 text-right tabular-nums">{r.aa.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
              {!porProducto.length && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">Sin movimientos todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-display mb-2">Existencias por depósito</h3>
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="text-left p-2">Depósito</th>
                <th className="text-left p-2">Producto</th>
                <th className="text-right p-2">Litros</th>
                <th className="text-right p-2">Grado medio</th>
                <th className="text-right p-2">Alc. abs.</th>
              </tr>
            </thead>
            <tbody>
              {existencias
                .sort((a, b) => Number(b.litros) - Number(a.litros))
                .map((e, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{depById[e.deposito_id]?.codigo ?? e.deposito_id}</td>
                  <td className="p-2">{prodById[e.producto_id]?.nombre ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{Number(e.litros).toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                  <td className="p-2 text-right tabular-nums">{Number(e.grado_medio).toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{Number(e.alcohol_absoluto).toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
              {!existencias.length && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">Sin existencias.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
