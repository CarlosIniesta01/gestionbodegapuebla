import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3, Download, FileSpreadsheet, FileText, Filter, X, ChevronRight,
} from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import {
  getPosicionComercial, getPosicionDetalle, type PosicionRow,
} from "@/lib/api/posicion-comercial.functions";

export const Route = createFileRoute("/_authenticated/posicion-comercial")({
  head: () => ({ meta: [{ title: "Posición Comercial · Vinea Control" }] }),
  component: PosicionComercialPage,
});

const fmt = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) : "0";

type SortKey =
  | "producto_nombre" | "campana" | "tipo"
  | "litros_existencia" | "compras_pendientes" | "ventas_pendientes"
  | "disponible_comercial" | "alcohol_absoluto";

type Filters = {
  q: string;
  campana: string;
  tipo: string;
  color: string;
  estado: "todos" | "positivo" | "bajo" | "negativo";
};

const ESTADO_THRESHOLD_BAJO = 1000;

function estadoComercial(disp: number): "positivo" | "bajo" | "negativo" {
  if (disp < 0) return "negativo";
  if (disp < ESTADO_THRESHOLD_BAJO) return "bajo";
  return "positivo";
}

function estadoClass(e: ReturnType<typeof estadoComercial>) {
  if (e === "negativo") return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  if (e === "bajo") return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
}

function PosicionComercialPage() {
  const { bodegaId } = useActiveBodega();
  const fn = useServerFn(getPosicionComercial);
  const dataQ = useQuery({
    queryKey: ["posicion-comercial", bodegaId],
    queryFn: () => fn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
    staleTime: 30_000,
  });

  const [filters, setFilters] = useState<Filters>({ q: "", campana: "", tipo: "", color: "", estado: "todos" });
  const [sortKey, setSortKey] = useState<SortKey>("producto_nombre");
  const [sortAsc, setSortAsc] = useState(true);
  const [openProductoId, setOpenProductoId] = useState<string | null>(null);

  const rows = dataQ.data ?? [];

  const opts = useMemo(() => {
    const u = (k: keyof PosicionRow) =>
      Array.from(new Set(rows.map((r) => (r[k] as string | null) ?? "").filter(Boolean))).sort();
    return { campanas: u("campana"), tipos: u("tipo"), colores: u("color") };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let r = rows.filter((x) => {
      if (q) {
        const hay = `${x.producto_nombre ?? ""} ${x.codigo ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.campana && (x.campana ?? "") !== filters.campana) return false;
      if (filters.tipo && (x.tipo ?? "") !== filters.tipo) return false;
      if (filters.color && (x.color ?? "") !== filters.color) return false;
      if (filters.estado !== "todos" && estadoComercial(x.disponible_comercial) !== filters.estado) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return r;
  }, [rows, filters, sortKey, sortAsc]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.existencia += r.litros_existencia;
        acc.compras += r.compras_pendientes;
        acc.ventas += r.ventas_pendientes;
        acc.disponible += r.disponible_comercial;
        acc.alcohol += r.alcohol_absoluto;
        return acc;
      },
      { existencia: 0, compras: 0, ventas: 0, disponible: 0, alcohol: 0 },
    );
  }, [filtered]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  const exportCSV = () => {
    const headers = ["Producto","Código","Campaña","Tipo","Color","Existencia (L)","Compra Pendiente (L)","Venta Pendiente (L)","Disponible Comercial (L)","Alcohol Absoluto (L)"];
    const lines = [headers.join(";")];
    for (const r of filtered) {
      lines.push([
        r.producto_nombre ?? "", r.codigo ?? "", r.campana ?? "", r.tipo ?? "", r.color ?? "",
        r.litros_existencia.toFixed(2), r.compras_pendientes.toFixed(2),
        r.ventas_pendientes.toFixed(2), r.disponible_comercial.toFixed(2),
        r.alcohol_absoluto.toFixed(2),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    }
    downloadBlob(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), "posicion-comercial.csv");
  };

  const exportXLS = () => {
    // SpreadsheetML-compatible: Excel opens .xls with HTML table content.
    const head = `<tr>${["Producto","Código","Campaña","Tipo","Color","Existencia (L)","Compra Pendiente (L)","Venta Pendiente (L)","Disponible Comercial (L)","Alcohol Absoluto (L)"].map((h) => `<th>${h}</th>`).join("")}</tr>`;
    const body = filtered.map((r) => `<tr>${[
      r.producto_nombre ?? "", r.codigo ?? "", r.campana ?? "", r.tipo ?? "", r.color ?? "",
      r.litros_existencia.toFixed(2), r.compras_pendientes.toFixed(2),
      r.ventas_pendientes.toFixed(2), r.disponible_comercial.toFixed(2),
      r.alcohol_absoluto.toFixed(2),
    ].map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${head}${body}</table></body></html>`;
    downloadBlob(new Blob([html], { type: "application/vnd.ms-excel" }), "posicion-comercial.xls");
  };

  const exportPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = filtered.map((r) => {
      const e = estadoComercial(r.disponible_comercial);
      const col = e === "negativo" ? "#dc2626" : e === "bajo" ? "#d97706" : "#059669";
      return `<tr>
        <td>${r.producto_nombre ?? ""}</td>
        <td>${r.campana ?? ""}</td>
        <td>${r.tipo ?? ""}</td>
        <td style="text-align:right">${fmt(r.litros_existencia)}</td>
        <td style="text-align:right">${fmt(r.compras_pendientes)}</td>
        <td style="text-align:right">${fmt(r.ventas_pendientes)}</td>
        <td style="text-align:right;color:${col};font-weight:600">${fmt(r.disponible_comercial)}</td>
        <td style="text-align:right">${fmt(r.alcohol_absoluto, 2)}</td>
      </tr>`;
    }).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Posición Comercial</title>
      <style>body{font-family:system-ui,Arial;padding:20px;font-size:11px}
      h1{font-size:16px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f4}
      .kpis{display:flex;gap:12px;margin-bottom:16px}
      .kpi{border:1px solid #ddd;border-radius:8px;padding:10px 12px;flex:1}
      .kpi b{display:block;font-size:14px;margin-top:4px}
      .kpi span{color:#666;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
      @media print{button{display:none}}</style></head><body>
      <h1>Posición Comercial</h1>
      <div class="kpis">
        <div class="kpi"><span>Existencia</span><b>${fmt(totals.existencia)} L</b></div>
        <div class="kpi"><span>Compra Pendiente</span><b>${fmt(totals.compras)} L</b></div>
        <div class="kpi"><span>Venta Pendiente</span><b>${fmt(totals.ventas)} L</b></div>
        <div class="kpi"><span>Disponible</span><b>${fmt(totals.disponible)} L</b></div>
        <div class="kpi"><span>Alcohol Absoluto</span><b>${fmt(totals.alcohol, 2)} L</b></div>
      </div>
      <table><thead><tr>
        <th>Producto</th><th>Campaña</th><th>Tipo</th>
        <th>Existencia</th><th>Compra Pend.</th><th>Venta Pend.</th>
        <th>Disponible</th><th>Alcohol Abs.</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / PDF</button>
      </body></html>`);
    w.document.close();
  };

  if (!bodegaId) return <div className="p-8 text-sm text-muted-foreground">Sin bodega activa.</div>;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight flex items-center gap-2">
            <BarChart3 className="size-5" /> Posición Comercial
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Existencias, contratos pendientes y disponibilidad por producto en tiempo real.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border hover:bg-sidebar-accent/50">
            <Download className="size-3.5" /> CSV
          </button>
          <button onClick={exportXLS} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border hover:bg-sidebar-accent/50">
            <FileSpreadsheet className="size-3.5" /> Excel
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border hover:bg-sidebar-accent/50">
            <FileText className="size-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Existencia Física" value={`${fmt(totals.existencia)} L`} />
        <Kpi label="Compra Pendiente" value={`${fmt(totals.compras)} L`} />
        <Kpi label="Venta Pendiente" value={`${fmt(totals.ventas)} L`} />
        <Kpi label="Disponible Comercial" value={`${fmt(totals.disponible)} L`}
             accent={estadoClass(estadoComercial(totals.disponible))} />
        <Kpi label="Alcohol Absoluto" value={`${fmt(totals.alcohol, 2)} L`} />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap gap-2 items-center">
        <Filter className="size-4 text-muted-foreground" />
        <input
          value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Buscar producto…"
          className="px-2 py-1.5 text-xs rounded-md border border-border bg-background min-w-[180px]"
        />
        <Select v={filters.campana} onV={(v) => setFilters((f) => ({ ...f, campana: v }))} ph="Campaña" opts={opts.campanas} />
        <Select v={filters.tipo} onV={(v) => setFilters((f) => ({ ...f, tipo: v }))} ph="Tipo" opts={opts.tipos} />
        <Select v={filters.color} onV={(v) => setFilters((f) => ({ ...f, color: v }))} ph="Color" opts={opts.colores} />
        <Select
          v={filters.estado === "todos" ? "" : filters.estado}
          onV={(v) => setFilters((f) => ({ ...f, estado: (v || "todos") as Filters["estado"] }))}
          ph="Estado" opts={["positivo", "bajo", "negativo"]}
        />
        {(filters.q || filters.campana || filters.tipo || filters.color || filters.estado !== "todos") && (
          <button onClick={() => setFilters({ q: "", campana: "", tipo: "", color: "", estado: "todos" })}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="size-3" /> Limpiar
          </button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} producto(s)</div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {dataQ.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : dataQ.error ? (
          <div className="p-10 text-center text-sm text-rose-600">{(dataQ.error as Error).message}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Sin datos para los filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sidebar-accent/40 text-muted-foreground">
                <tr>
                  <Th k="producto_nombre" sk={sortKey} sa={sortAsc} on={toggleSort}>Producto</Th>
                  <Th k="campana" sk={sortKey} sa={sortAsc} on={toggleSort}>Campaña</Th>
                  <Th k="tipo" sk={sortKey} sa={sortAsc} on={toggleSort}>Tipo</Th>
                  <Th k="litros_existencia" sk={sortKey} sa={sortAsc} on={toggleSort} right>Existencia</Th>
                  <Th k="compras_pendientes" sk={sortKey} sa={sortAsc} on={toggleSort} right>Compra Pend.</Th>
                  <Th k="ventas_pendientes" sk={sortKey} sa={sortAsc} on={toggleSort} right>Venta Pend.</Th>
                  <Th k="disponible_comercial" sk={sortKey} sa={sortAsc} on={toggleSort} right>Disponible</Th>
                  <Th k="alcohol_absoluto" sk={sortKey} sa={sortAsc} on={toggleSort} right>Alcohol Abs.</Th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const e = estadoComercial(r.disponible_comercial);
                  return (
                    <tr key={r.producto_id} className="border-t border-border hover:bg-sidebar-accent/20 cursor-pointer"
                        onClick={() => setOpenProductoId(r.producto_id)}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.producto_nombre ?? "—"}</div>
                        {r.codigo && <div className="text-[10px] text-muted-foreground">{r.codigo}</div>}
                      </td>
                      <td className="px-3 py-2">{r.campana ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {r.color && <span className="size-2 rounded-full" style={{ background: colorDot(r.color) }} />}
                          {r.tipo ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.litros_existencia)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.compras_pendientes)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.ventas_pendientes)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border tabular-nums font-medium ${estadoClass(e)}`}>
                          {fmt(r.disponible_comercial)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.alcohol_absoluto, 2)}</td>
                      <td className="px-3 py-2"><ChevronRight className="size-3.5 text-muted-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-sidebar-accent/30 font-medium">
                <tr className="border-t border-border">
                  <td className="px-3 py-2" colSpan={3}>Totales filtrados</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.existencia)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.compras)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.ventas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.disponible)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.alcohol, 2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {openProductoId && bodegaId && (
        <DetalleDialog bodegaId={bodegaId} productoId={openProductoId}
          row={rows.find((r) => r.producto_id === openProductoId) ?? null}
          onClose={() => setOpenProductoId(null)} />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-3 ${accent ?? "border-border"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Th({ children, k, sk, sa, on, right }: {
  children: React.ReactNode; k: SortKey; sk: SortKey; sa: boolean; on: (k: SortKey) => void; right?: boolean;
}) {
  const active = sk === k;
  return (
    <th onClick={() => on(k)} className={`px-3 py-2 cursor-pointer select-none font-medium ${right ? "text-right" : "text-left"}`}>
      <span className={active ? "text-foreground" : ""}>{children}{active ? (sa ? " ↑" : " ↓") : ""}</span>
    </th>
  );
}

function Select({ v, onV, ph, opts }: { v: string; onV: (v: string) => void; ph: string; opts: string[] }) {
  return (
    <select value={v} onChange={(e) => onV(e.target.value)}
      className="px-2 py-1.5 text-xs rounded-md border border-border bg-background">
      <option value="">{ph} (todos)</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function colorDot(color: string): string {
  const c = color.toLowerCase();
  if (c.includes("tinto")) return "#7c1d1d";
  if (c.includes("blanco")) return "#f5e6a8";
  if (c.includes("rosado") || c.includes("rosa")) return "#f4a8b8";
  return "#94a3b8";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function DetalleDialog({ bodegaId, productoId, row, onClose }: {
  bodegaId: string; productoId: string; row: PosicionRow | null; onClose: () => void;
}) {
  const fn = useServerFn(getPosicionDetalle);
  const q = useQuery({
    queryKey: ["posicion-detalle", bodegaId, productoId],
    queryFn: () => fn({ data: { bodegaId, productoId } }),
  });
  const d = q.data;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start md:items-center justify-center p-2 md:p-6 overflow-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-5xl my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-display text-lg">{row?.producto_nombre ?? "Producto"}</h2>
            <div className="text-xs text-muted-foreground">
              {row?.codigo ? `${row.codigo} · ` : ""}{row?.campana ?? ""} {row?.tipo ?? ""} {row?.color ?? ""}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-sidebar-accent/50"><X className="size-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          {q.isLoading ? <div className="text-sm text-muted-foreground">Cargando…</div> :
           q.error ? <div className="text-sm text-rose-600">{(q.error as Error).message}</div> :
           d && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Kpi label="Existencia" value={`${fmt(row?.litros_existencia ?? 0)} L`} />
                <Kpi label="Compra Pend." value={`${fmt(row?.compras_pendientes ?? 0)} L`} />
                <Kpi label="Venta Pend." value={`${fmt(row?.ventas_pendientes ?? 0)} L`} />
                <Kpi label="Disponible" value={`${fmt(row?.disponible_comercial ?? 0)} L`}
                     accent={estadoClass(estadoComercial(row?.disponible_comercial ?? 0))} />
              </div>

              <Section title={`Existencias en depósitos (${d.existencias.length})`}>
                {d.existencias.length === 0 ? <Empty>Sin existencias.</Empty> : (
                  <SimpleTable headers={["Depósito","Litros","Grado","Alcohol Abs."]}
                    rows={d.existencias.map((e: any) => [
                      e.deposito_codigo ?? e.deposito_id, `${fmt(Number(e.litros))} L`,
                      `${Number(e.grado_medio ?? 0).toFixed(2)}°`,
                      `${Number(e.alcohol_absoluto ?? 0).toFixed(2)} L`,
                    ])} />
                )}
              </Section>

              <Section title={`Contratos de compra (${d.compras.length})`}>
                {d.compras.length === 0 ? <Empty>Sin contratos.</Empty> : (
                  <SimpleTable headers={["Nº","Proveedor","Fecha","Contratado","Retirado","Pendiente","Estado"]}
                    rows={d.compras.map((c: any) => [
                      c.numero_contrato, c.proveedores?.nombre ?? "—", c.fecha_contrato ?? "—",
                      `${fmt(Number(c.litros_contratados))} L`,
                      `${fmt(Number(c.litros_retirados))} L`,
                      `${fmt(Number(c.litros_pendientes))} L`,
                      c.estado,
                    ])} />
                )}
              </Section>

              <Section title={`Contratos de venta (${d.ventas.length})`}>
                {d.ventas.length === 0 ? <Empty>Sin contratos.</Empty> : (
                  <SimpleTable headers={["Nº","Cliente","Fecha","Contratado","Servido","Pendiente","Estado"]}
                    rows={d.ventas.map((c: any) => [
                      c.numero_contrato, c.clientes?.nombre ?? "—", c.fecha_contrato ?? "—",
                      `${fmt(Number(c.litros_contratados))} L`,
                      `${fmt(Number(c.litros_servidos))} L`,
                      `${fmt(Number(c.litros_pendientes))} L`,
                      c.estado,
                    ])} />
                )}
              </Section>

              <Section title={`Movimientos recientes (${d.movimientos.length})`}>
                {d.movimientos.length === 0 ? <Empty>Sin movimientos.</Empty> : (
                  <SimpleTable headers={["Fecha","Tipo","Origen","Destino","Litros","Grado"]}
                    rows={d.movimientos.map((m: any) => [
                      m.fecha, m.tipo, m.deposito_origen_codigo ?? m.deposito_origen_id ?? "—", m.deposito_destino_codigo ?? m.deposito_destino_id ?? "—",
                      `${fmt(Number(m.litros))} L`,
                      m.grado != null ? `${Number(m.grado).toFixed(2)}°` : "—",
                    ])} />
                )}
              </Section>
            </>
           )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="px-3 py-2 border-b border-border bg-sidebar-accent/30 text-xs font-medium">{title}</div>
      <div className="p-2">{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground px-2 py-3">{children}</div>;
}
function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground"><tr>{headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
