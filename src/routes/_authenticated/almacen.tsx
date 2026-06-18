import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Beaker, Package, Layers, History, AlertTriangle, TrendingDown, CheckCircle2, XCircle } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useActiveBodega } from "@/hooks/use-active-bodega";
import { ProductosTab } from "@/components/admin/ProductosTab";
import { StockTab } from "@/components/admin/StockTab";
import { listLotes, listConsumos, listStockPorProducto } from "@/lib/api/lotes.functions";
import { listProductos } from "@/lib/api/productos.functions";

export const Route = createFileRoute("/_authenticated/almacen")({
  head: () => ({ meta: [{ title: "Almacén enológico · Vinea Control" }] }),
  component: AlmacenPage,
});

function AlmacenPage() {
  const { bodegaId, bodega, isLoading } = useActiveBodega();

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando…</div>;
  if (!bodegaId) return <div className="p-6 text-muted-foreground">No tienes acceso a ninguna bodega.</div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Almacén</div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight flex items-center gap-2">
          <Beaker className="size-6 text-primary" /> Almacén enológico
        </h1>
        <p className="text-muted-foreground text-sm">
          Productos, lotes, consumos y trazabilidad de {bodega?.nombre ?? "la bodega"}.
        </p>
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="resumen"><TrendingDown className="size-4 mr-2" />Resumen</TabsTrigger>
          <TabsTrigger value="productos"><Package className="size-4 mr-2" />Productos</TabsTrigger>
          <TabsTrigger value="lotes"><Layers className="size-4 mr-2" />Lotes</TabsTrigger>
          <TabsTrigger value="consumos"><History className="size-4 mr-2" />Movimientos</TabsTrigger>
          <TabsTrigger value="alertas"><AlertTriangle className="size-4 mr-2" />Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-6"><ResumenTab bodegaId={bodegaId} /></TabsContent>
        <TabsContent value="productos" className="mt-6"><ProductosTab bodegaId={bodegaId} /></TabsContent>
        <TabsContent value="lotes" className="mt-6"><LotesGlobalTab bodegaId={bodegaId} /></TabsContent>
        <TabsContent value="consumos" className="mt-6"><ConsumosGlobalTab bodegaId={bodegaId} /></TabsContent>
        <TabsContent value="alertas" className="mt-6"><AlertasTab bodegaId={bodegaId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== RESUMEN ==============
function ResumenTab({ bodegaId }: { bodegaId: string }) {
  const fnStock = useServerFn(listStockPorProducto);
  const fnLotes = useServerFn(listLotes);
  const fnCons = useServerFn(listConsumos);

  const stockQ = useQuery({ queryKey: ["alm-stock", bodegaId], queryFn: () => fnStock({ data: { bodegaId } }) });
  const lotesQ = useQuery({ queryKey: ["alm-lotes-all", bodegaId], queryFn: () => fnLotes({ data: { bodegaId } }) });
  const consQ = useQuery({ queryKey: ["alm-cons-all", bodegaId], queryFn: () => fnCons({ data: { bodegaId, limit: 50 } }) });

  const stock = stockQ.data ?? [];
  const lotes = lotesQ.data ?? [];
  const cons = consQ.data ?? [];

  const productos = stock.length;
  const lotesActivos = lotes.filter((l: any) => l.estado === "disponible").length;
  const lotesCaducados = lotes.filter((l: any) => l.estado === "caducado").length;
  const criticos = stock.filter((s: any) => s.stock_critico != null && Number(s.stock_disponible) <= Number(s.stock_critico)).length;

  const Cards = [
    { label: "Productos", value: productos, icon: Package, color: "text-primary" },
    { label: "Lotes activos", value: lotesActivos, icon: Layers, color: "text-emerald-600" },
    { label: "Lotes caducados", value: lotesCaducados, icon: XCircle, color: "text-rose-600" },
    { label: "Stock crítico", value: criticos, icon: AlertTriangle, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Cards.map((c) => (
          <div key={c.label} className="scada-panel p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
              <c.icon className={`size-4 ${c.color}`} />
            </div>
            <div className="text-3xl font-display font-semibold mt-2">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Últimos movimientos</div>
        {cons.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Sin movimientos registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/20 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Producto</th>
                <th className="text-left px-3 py-2">Lote</th>
                <th className="text-right px-3 py-2">Cantidad</th>
                <th className="text-left px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cons.slice(0, 12).map((c: any) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-xs">{c.fecha} {c.hora?.slice(0, 5)}</td>
                  <td className="px-3 py-2 font-medium">{c.productos?.nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{c.producto_lotes?.numero_lote ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(c.cantidad).toFixed(3)} {c.unidad}</td>
                  <td className="px-3 py-2">
                    {c.anulado ? <Badge variant="outline" className="border-rose-500/50 text-rose-600">anulado</Badge>
                      : <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">consumido</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============== LOTES (global) ==============
const LOTE_BADGE: Record<string, string> = {
  disponible: "border-emerald-500/50 text-emerald-600",
  agotado: "border-zinc-500/50 text-zinc-500",
  caducado: "border-rose-500/50 text-rose-600",
  bloqueado: "border-amber-500/50 text-amber-600",
};

function LotesGlobalTab({ bodegaId }: { bodegaId: string }) {
  const fn = useServerFn(listLotes);
  const fnProd = useServerFn(listProductos);
  const [estado, setEstado] = React.useState<string>("all");
  const [productoId, setProductoId] = React.useState<string>("all");
  const [filtro, setFiltro] = React.useState("");

  const prodQ = useQuery({ queryKey: ["alm-prods", bodegaId], queryFn: () => fnProd({ data: { bodegaId, soloActivos: false } }) });
  const q = useQuery({
    queryKey: ["alm-lotes", bodegaId, estado, productoId],
    queryFn: () => fn({ data: {
      bodegaId,
      estado: estado === "all" ? undefined : (estado as any),
      producto_id: productoId === "all" ? undefined : productoId,
    } }),
  });

  const rows = (q.data ?? []).filter((l: any) => {
    if (!filtro) return true;
    const f = filtro.toLowerCase();
    return l.numero_lote?.toLowerCase().includes(f) || l.productos?.nombre?.toLowerCase().includes(f);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2">
        <Input placeholder="Buscar lote o producto…" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="md:flex-1" />
        <Select value={productoId} onValueChange={setProductoId}>
          <SelectTrigger className="md:w-[220px]"><SelectValue placeholder="Producto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los productos</SelectItem>
            {(prodQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="disponible">Disponible</SelectItem>
            <SelectItem value="agotado">Agotado</SelectItem>
            <SelectItem value="caducado">Caducado</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Lotes ({rows.length})</div>
        {q.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Layers className="size-8 mx-auto mb-2 opacity-50" />
            Sin lotes que coincidan con el filtro.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/20 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Producto</th>
                <th className="text-left px-3 py-2">Lote</th>
                <th className="text-left px-3 py-2">Proveedor</th>
                <th className="text-right px-3 py-2">Disponible</th>
                <th className="text-right px-3 py-2">Inicial</th>
                <th className="text-left px-3 py-2">Caducidad</th>
                <th className="text-left px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l: any) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 font-medium">{l.productos?.nombre ?? "—"}</td>
                  <td className="px-3 py-2">{l.numero_lote}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.proveedor ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(l.cantidad_disponible).toFixed(3)} {l.unidad}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{Number(l.cantidad_inicial).toFixed(3)}</td>
                  <td className="px-3 py-2 text-xs">{l.fecha_caducidad ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={LOTE_BADGE[l.estado] ?? ""}>{l.estado}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============== CONSUMOS / MOVIMIENTOS ==============
function ConsumosGlobalTab({ bodegaId }: { bodegaId: string }) {
  const fn = useServerFn(listConsumos);
  const fnProd = useServerFn(listProductos);
  const [productoId, setProductoId] = React.useState<string>("all");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");

  const prodQ = useQuery({ queryKey: ["alm-prods", bodegaId], queryFn: () => fnProd({ data: { bodegaId, soloActivos: false } }) });
  const q = useQuery({
    queryKey: ["alm-cons", bodegaId, productoId, desde, hasta],
    queryFn: () => fn({ data: {
      bodegaId,
      producto_id: productoId === "all" ? undefined : productoId,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limit: 500,
    } }),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2">
        <Select value={productoId} onValueChange={setProductoId}>
          <SelectTrigger className="md:w-[240px]"><SelectValue placeholder="Producto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los productos</SelectItem>
            {(prodQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="md:w-[170px]" />
        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="md:w-[170px]" />
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">Consumos ({rows.length})</div>
        {q.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <History className="size-8 mx-auto mb-2 opacity-50" />
            Sin movimientos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/20 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Producto</th>
                  <th className="text-left px-3 py-2">Lote</th>
                  <th className="text-right px-3 py-2">Cantidad</th>
                  <th className="text-left px-3 py-2">Trabajo</th>
                  <th className="text-left px-3 py-2">Depósito</th>
                  <th className="text-left px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{c.fecha} {c.hora?.slice(0, 5)}</td>
                    <td className="px-3 py-2 font-medium">{c.productos?.nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{c.producto_lotes?.numero_lote ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(c.cantidad).toFixed(3)} {c.unidad}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.trabajo_id ? c.trabajo_id.slice(0, 8) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{c.deposito_id ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.anulado ? <Badge variant="outline" className="border-rose-500/50 text-rose-600">anulado</Badge>
                        : c.uso_caducado_autorizado ? <Badge variant="outline" className="border-amber-500/50 text-amber-600">caducado autorizado</Badge>
                        : <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">consumido</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== ALERTAS ==============
function AlertasTab({ bodegaId }: { bodegaId: string }) {
  const fnStock = useServerFn(listStockPorProducto);
  const fnLotes = useServerFn(listLotes);

  const stockQ = useQuery({ queryKey: ["alm-stock-al", bodegaId], queryFn: () => fnStock({ data: { bodegaId } }) });
  const lotesQ = useQuery({ queryKey: ["alm-lotes-al", bodegaId], queryFn: () => fnLotes({ data: { bodegaId } }) });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

  const stock = stockQ.data ?? [];
  const lotes = lotesQ.data ?? [];

  const criticos = stock.filter((s: any) => s.stock_critico != null && Number(s.stock_disponible) <= Number(s.stock_critico));
  const bajos = stock.filter((s: any) => {
    const st = Number(s.stock_disponible);
    return s.stock_minimo != null && st <= Number(s.stock_minimo) && !(s.stock_critico != null && st <= Number(s.stock_critico));
  });
  const caducados = lotes.filter((l: any) => l.estado === "caducado");
  const proximos = lotes.filter((l: any) => {
    if (!l.fecha_caducidad || l.estado !== "disponible") return false;
    const d = new Date(l.fecha_caducidad);
    return d >= today && d <= in30;
  });
  const bloqueados = lotes.filter((l: any) => l.estado === "bloqueado");

  const Section = ({ title, items, render, color, icon: Icon }: any) => (
    <div className="scada-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium flex items-center gap-2">
        <Icon className={`size-4 ${color}`} />
        {title} <span className="text-muted-foreground">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" /> Sin alertas.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it: any, i: number) => <li key={i} className="px-4 py-2 text-sm">{render(it)}</li>)}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Section title="Stock crítico" color="text-rose-600" icon={AlertTriangle} items={criticos}
        render={(s: any) => (
          <div className="flex justify-between gap-3">
            <span className="font-medium">{s.nombre}</span>
            <span className="font-mono text-rose-600">{Number(s.stock_disponible).toFixed(3)} {s.unidad}</span>
          </div>
        )} />
      <Section title="Stock bajo" color="text-amber-600" icon={TrendingDown} items={bajos}
        render={(s: any) => (
          <div className="flex justify-between gap-3">
            <span className="font-medium">{s.nombre}</span>
            <span className="font-mono text-amber-600">{Number(s.stock_disponible).toFixed(3)} {s.unidad}</span>
          </div>
        )} />
      <Section title="Lotes caducados" color="text-rose-600" icon={XCircle} items={caducados}
        render={(l: any) => (
          <div className="flex justify-between gap-3">
            <span><span className="font-medium">{l.productos?.nombre}</span> · <span className="text-muted-foreground">{l.numero_lote}</span></span>
            <span className="text-xs text-rose-600">{l.fecha_caducidad}</span>
          </div>
        )} />
      <Section title="Próximos a caducar (30 días)" color="text-amber-600" icon={AlertTriangle} items={proximos}
        render={(l: any) => (
          <div className="flex justify-between gap-3">
            <span><span className="font-medium">{l.productos?.nombre}</span> · <span className="text-muted-foreground">{l.numero_lote}</span></span>
            <span className="text-xs text-amber-600">{l.fecha_caducidad}</span>
          </div>
        )} />
      <Section title="Lotes bloqueados" color="text-amber-600" icon={XCircle} items={bloqueados}
        render={(l: any) => (
          <div className="flex justify-between gap-3">
            <span><span className="font-medium">{l.productos?.nombre}</span> · <span className="text-muted-foreground">{l.numero_lote}</span></span>
            <span className="text-xs text-amber-600 truncate max-w-[40%]">{l.motivo_bloqueo ?? ""}</span>
          </div>
        )} />
    </div>
  );
}
