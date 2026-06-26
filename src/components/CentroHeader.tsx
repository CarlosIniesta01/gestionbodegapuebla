import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe2 } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { centroIdentity, GLOBAL_IDENTITY } from "@/lib/centro-identity";
import { getCentroResumen, type CentroResumen } from "@/lib/api/centros.functions";

const fmt = (n: number, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "0";

function Chip({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "warn" | "danger" | "ok" }) {
  const palette: Record<string, { bg: string; fg: string; bd: string }> = {
    neutral: { bg: "#f8fafc", fg: "#0f172a", bd: "#e2e8f0" },
    ok:      { bg: "#ecfdf3", fg: "#067647", bd: "#abefc6" },
    warn:    { bg: "#fffaeb", fg: "#b54708", bd: "#fedf89" },
    danger:  { bg: "#fef3f2", fg: "#b42318", bd: "#fda29b" },
  };
  const p = palette[tone];
  return (
    <div
      className="rounded-md border px-2.5 py-1.5"
      style={{ background: p.bg, color: p.fg, borderColor: p.bd }}
    >
      <div className="text-[10px] uppercase tracking-[0.12em] opacity-80 leading-none">{label}</div>
      <div className="text-[13px] font-semibold leading-tight mt-0.5">{value}</div>
    </div>
  );
}

export function CentroHeader({ showResumen = true }: { showResumen?: boolean }) {
  const { bodegaId, bodega, isGlobal, viewMode, setViewMode } = useActiveBodega();
  const fn = useServerFn(getCentroResumen);
  const q = useQuery({
    queryKey: ["centro-resumen", bodegaId],
    queryFn: () => fn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId && !isGlobal && showResumen,
    staleTime: 30_000,
  });

  const ident = isGlobal ? GLOBAL_IDENTITY : centroIdentity(bodega);
  const Icon = ident?.Icon ?? Globe2;
  const title = isGlobal ? "Visión global" : (bodega?.nombre ?? "Centro");
  const r = q.data as CentroResumen | undefined;

  return (
    <div
      className="rounded-lg border bg-card overflow-hidden"
      style={{ borderColor: "var(--border)", borderTop: `3px solid ${ident.color}` }}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span
          className="inline-flex items-center justify-center rounded-md size-10 shrink-0"
          style={{ background: ident.soft, color: ident.text }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Centro activo</div>
          <div className="text-[16px] font-semibold truncate">{title}</div>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setViewMode("centro")}
            className="h-7 px-2.5 text-[12px] rounded-sm font-medium transition-colors"
            style={{
              background: viewMode === "centro" ? ident.color : "transparent",
              color: viewMode === "centro" ? "#fff" : "var(--foreground)",
            }}
          >
            Centro
          </button>
          <button
            onClick={() => setViewMode("global")}
            className="h-7 px-2.5 text-[12px] rounded-sm font-medium transition-colors inline-flex items-center gap-1"
            style={{
              background: viewMode === "global" ? GLOBAL_IDENTITY.color : "transparent",
              color: viewMode === "global" ? "#fff" : "var(--foreground)",
            }}
          >
            <Globe2 className="size-3" /> Global
          </button>
        </div>
      </div>

      {showResumen && !isGlobal && r && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 px-4 pb-3">
          <Chip label="Ocupación" value={`${r.ocupacion_pct}%`} tone={r.ocupacion_pct >= 90 ? "warn" : "neutral"} />
          <Chip label="Litros" value={fmt(r.litros_totales)} />
          <Chip label="Capacidad" value={fmt(r.capacidad_total)} />
          <Chip label="Dep. ocupados" value={`${r.depositos_ocupados}/${r.depositos_total}`} />
          <Chip label="Dep. libres" value={r.depositos_vacios} tone={r.depositos_vacios === 0 ? "warn" : "neutral"} />
          <Chip label="Dep. >90%" value={r.depositos_llenos_90} tone={r.depositos_llenos_90 ? "warn" : "neutral"} />
          <Chip label="Trabajos abiertos" value={r.trabajos_abiertos} />
          <Chip label="Incidencias" value={r.incidencias_abiertas} tone={r.incidencias_abiertas ? "danger" : "neutral"} />
          <Chip label="Mov. hoy" value={r.movimientos_hoy} />
          <Chip label="Trasiegos activos" value={r.trasiegos_activos} />
          <Chip label="Contratos pdtes." value={r.contratos_pendientes} />
          <Chip label="Lotes caducan ≤30d" value={r.lotes_por_caducar} tone={r.lotes_por_caducar ? "warn" : "neutral"} />
        </div>
      )}
    </div>
  );
}
