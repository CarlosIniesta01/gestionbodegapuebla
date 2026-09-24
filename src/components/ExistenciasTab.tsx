import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExistencias, listExistenciasPorProducto } from "@/lib/api/movimientos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { ImportarExistenciasDialog } from "@/components/ImportarExistenciasDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props { bodegaId: string }

export function ExistenciasTab({ bodegaId }: Props) {
  const listE = useServerFn(listExistencias);
  const listEP = useServerFn(listExistenciasPorProducto);
  const listP = useServerFn(listProductosComerciales);
  const { depositos } = useBodegaMap(bodegaId);

  const eQ = useQuery({
    queryKey: ["existencias", bodegaId],
    queryFn: () => listE({ data: { bodegaId } }),
  });
  const epQ = useQuery({
    queryKey: ["existencias-por-producto", bodegaId],
    queryFn: () => listEP({ data: { bodegaId } }),
  });
  const pQ = useQuery({
    queryKey: ["productos-comerciales", bodegaId],
    queryFn: () => listP({ data: { bodegaId } }),
  });

  const existencias = (eQ.data ?? []) as any[];
  const existenciasPorProducto = (epQ.data ?? []) as any[];
  const productos = (pQ.data ?? []) as any[];

  const prodById = useMemo(() => Object.fromEntries(productos.map((p) => [p.id, p])), [productos]);
  const depById = useMemo(() => Object.fromEntries(depositos.map((d) => [d.id, d])), [depositos]);

  const [filtroProducto, setFiltroProducto] = useState<string>("__todos__");
  const [filtroCampana, setFiltroCampana] = useState<string>("__todos__");
  const [filtroTipoColor, setFiltroTipoColor] = useState<string>("__todos__");
  const [importOpen, setImportOpen] = useState(false);

  const filasPorProducto = useMemo(() => {
    const rows = existenciasPorProducto.map((e: any) => {
      const p = e?.producto_id ? prodById[e.producto_id] : null;
      const tipoColor = p ? [p.tipo, p.color].filter(Boolean).join(" / ") : "";
      return {
        producto_id: e?.producto_id ?? null,
        producto: p?.nombre ?? "(sin producto)",
        codigo: p?.codigo ?? "—",
        campana: p?.campaña ?? "—",
        tipoColor: tipoColor || "—",
        litros: Number(e?.litros ?? 0) || 0,
        grado_medio: Number(e?.grado_medio ?? 0) || 0,
        alcohol_absoluto: Number(e?.alcohol_absoluto ?? 0) || 0,
      };
    });

    return rows
      .filter((r) => {
        if (filtroProducto !== "__todos__" && r.producto_id !== filtroProducto) return false;
        if (filtroCampana !== "__todos__" && (r.campana ?? "") !== filtroCampana) return false;
        if (filtroTipoColor !== "__todos__" && (r.tipoColor ?? "") !== filtroTipoColor) return false;
        return true;
      })
      .sort((a, b) => b.litros - a.litros);
  }, [existenciasPorProducto, prodById, filtroProducto, filtroCampana, filtroTipoColor]);

  const totales = useMemo(() => {
    const totalLitros = filasPorProducto.reduce((sum, r) => sum + r.litros, 0);
    const totalAA = filasPorProducto.reduce((sum, r) => sum + r.alcohol_absoluto, 0);
    const gradoGlobal = totalLitros > 0 ? (totalAA * 100) / totalLitros : 0;
    return { totalLitros, totalAA, gradoGlobal };
  }, [filasPorProducto]);

  const campanasUnicas = useMemo(
    () => Array.from(new Set(productos.map((p: any) => p?.campaña).filter(Boolean))).sort() as string[],
    [productos]
  );
  const tipoColorUnicos = useMemo(() => {
    const vals = new Set<string>();
    productos.forEach((p: any) => {
      const t = [p?.tipo, p?.color].filter(Boolean).join(" / ");
      if (t) vals.add(t);
    });
    return Array.from(vals).sort();
  }, [productos]);

  const isLoading = eQ.isLoading || epQ.isLoading || pQ.isLoading;
  const error = eQ.error || epQ.error || pQ.error;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        No se pudieron cargar las existencias: {(error as Error).message ?? "error desconocido"}
      </div>
    );
  }
  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando existencias…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="size-4 mr-2" />Importar desde Excel
        </Button>
      </div>
      <ImportarExistenciasDialog open={importOpen} onOpenChange={setImportOpen} bodegaId={bodegaId}
        depositos={depositos} productos={productos} existencias={existencias} />
      <Tabs defaultValue="por-producto">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="por-producto">Por producto</TabsTrigger>
          <TabsTrigger value="por-deposito">Por depósito</TabsTrigger>
        </TabsList>

        <TabsContent value="por-producto" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[200px] flex-1">
              <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground block mb-1">Producto</label>
              <Select value={filtroProducto} onValueChange={setFiltroProducto}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los productos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos los productos</SelectItem>
                  {productos
                    .slice()
                    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground block mb-1">Campaña</label>
              <Select value={filtroCampana} onValueChange={setFiltroCampana}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todas</SelectItem>
                  {campanasUnicas.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground block mb-1">Tipo / Color</label>
              <Select value={filtroTipoColor} onValueChange={setFiltroTipoColor}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {tipoColorUnicos.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Producto</th>
                  <th className="text-left p-2">Campaña</th>
                  <th className="text-left p-2">Tipo / Color</th>
                  <th className="text-right p-2">Litros totales</th>
                  <th className="text-right p-2">Grado medio</th>
                  <th className="text-right p-2">Alc. absoluto total</th>
                </tr>
              </thead>
              <tbody>
                {filasPorProducto.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">
                      <div className="font-medium">{r.producto}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.codigo}</div>
                    </td>
                    <td className="p-2">{r.campana}</td>
                    <td className="p-2">{r.tipoColor}</td>
                    <td className="p-2 text-right tabular-nums">{r.litros.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                    <td className="p-2 text-right tabular-nums">{r.grado_medio.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{r.alcohol_absoluto.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                  </tr>
                ))}
                {filasPorProducto.length > 0 && (
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                    <td className="p-2" colSpan={3}>Totales</td>
                    <td className="p-2 text-right tabular-nums">{totales.totalLitros.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                    <td className="p-2 text-right tabular-nums">{totales.gradoGlobal.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{totales.totalAA.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                  </tr>
                )}
                {!filasPorProducto.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground text-xs">Sin existencias para los filtros seleccionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="por-deposito" className="space-y-6">
          <section>
            <h3 className="text-sm font-display mb-2">Existencias por producto (resumen)</h3>
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
                  {(() => {
                    const m: Record<string, { litros: number; aa: number; nombre: string; codigo: string }> = {};
                    existencias.forEach((e) => {
                      const key = e.producto_id ?? "__sin__";
                      const p = e.producto_id ? prodById[e.producto_id] : null;
                      m[key] = m[key] ?? { litros: 0, aa: 0, nombre: p?.nombre ?? "(sin producto)", codigo: p?.codigo ?? "—" };
                      m[key].litros += Number(e.litros);
                      m[key].aa += Number(e.alcohol_absoluto);
                    });
                    const rows = Object.values(m).sort((a, b) => b.litros - a.litros);
                    return rows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 font-mono text-xs">{r.codigo}</td>
                        <td className="p-2">{r.nombre}</td>
                        <td className="p-2 text-right tabular-nums">{r.litros.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                        <td className="p-2 text-right tabular-nums">{r.aa.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td>
                      </tr>
                    ));
                  })()}
                  {!existencias.length && (
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
                    .sort((a: any, b: any) => Number(b.litros) - Number(a.litros))
                    .map((e: any, i: number) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
