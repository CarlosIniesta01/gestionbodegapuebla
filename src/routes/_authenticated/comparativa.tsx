import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { getComparativaCentros, type CentroResumen } from "@/lib/api/centros.functions";
import { centroIdentity } from "@/lib/centro-identity";

export const Route = createFileRoute("/_authenticated/comparativa")({
  head: () => ({
    meta: [
      { title: "Comparativa de centros · Vinea Control" },
      { name: "description", content: "Comparativa operativa entre todos los centros." },
    ],
  }),
  component: ComparativaPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">No encontrado.</div>,
});

type SortKey = keyof CentroResumen;

const COLS: Array<{ key: SortKey; label: string; fmt?: (v: any) => string; align?: string }> = [
  { key: "nombre", label: "Centro", align: "left" },
  { key: "capacidad_total", label: "Capacidad (L)", fmt: (v) => Number(v).toLocaleString("es-ES") },
  { key: "litros_totales", label: "Litros", fmt: (v) => Number(v).toLocaleString("es-ES") },
  { key: "ocupacion_pct", label: "Ocup. %", fmt: (v) => `${v}%` },
  { key: "depositos_ocupados", label: "Dep. ocup." },
  { key: "depositos_vacios", label: "Dep. libres" },
  { key: "trabajos_abiertos", label: "Trabajos" },
  { key: "incidencias_abiertas", label: "Incid." },
  { key: "contratos_pendientes", label: "Contratos pdtes." },
  { key: "disponible_comercial", label: "Disponible (L)", fmt: (v) => Number(v).toLocaleString("es-ES") },
];

function ComparativaPage() {
  const fn = useServerFn(getComparativaCentros);
  const q = useQuery({
    queryKey: ["comparativa-centros"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const [sortKey, setSortKey] = useState<SortKey>("ocupacion_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const arr = [...(q.data ?? [])];
    arr.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return arr;
  }, [q.data, sortKey, sortDir]);

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Dirección</div>
        <h1 className="text-[22px] font-semibold tracking-tight">Comparativa de centros</h1>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {q.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Calculando comparativa…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No hay centros para comparar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                  {COLS.map((c) => (
                    <th
                      key={c.key as string}
                      onClick={() => setSort(c.key)}
                      className={`px-3 py-2 cursor-pointer select-none whitespace-nowrap font-medium uppercase tracking-[0.1em] text-[10px] ${c.align === "left" ? "text-left" : "text-right"}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortKey === c.key && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ident = centroIdentity({ id: r.bodega_id, nombre: r.nombre });
                  const I = ident.Icon;
                  return (
                    <tr key={r.bodega_id} className="border-b last:border-b-0 hover:bg-accent/40" style={{ borderColor: "var(--border)" }}>
                      {COLS.map((c, i) => {
                        const v = (r as any)[c.key];
                        const text = c.fmt ? c.fmt(v) : String(v);
                        if (i === 0) {
                          return (
                            <td key={c.key as string} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center justify-center rounded-md size-7 shrink-0"
                                  style={{ background: ident.soft, color: ident.text }}
                                >
                                  <I className="size-3.5" />
                                </span>
                                <span className="font-medium">{r.nombre}</span>
                              </div>
                            </td>
                          );
                        }
                        const tone =
                          c.key === "ocupacion_pct" && Number(v) >= 90 ? "text-[#b54708] font-semibold"
                          : c.key === "incidencias_abiertas" && Number(v) > 0 ? "text-destructive font-semibold"
                          : c.key === "disponible_comercial" && Number(v) < 0 ? "text-destructive font-semibold"
                          : "";
                        return (
                          <td key={c.key as string} className={`px-3 py-2 text-right whitespace-nowrap font-mono ${tone}`}>
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
