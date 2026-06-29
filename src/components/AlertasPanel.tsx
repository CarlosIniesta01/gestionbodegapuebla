import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { getAlertas, type Alerta } from "@/lib/api/alertas.functions";

const SEV: Record<Alerta["severity"], { bg: string; fg: string; bd: string; Icon: typeof AlertTriangle }> = {
  danger: { bg: "#fef3f2", fg: "#b42318", bd: "#fda29b", Icon: AlertCircle },
  warn:   { bg: "#fffaeb", fg: "#b54708", bd: "#fedf89", Icon: AlertTriangle },
  info:   { bg: "#eff8ff", fg: "#175cd3", bd: "#b2ddff", Icon: Info },
};

type Props = {
  title?: string;
  categories?: Alerta["category"][];
  limit?: number;
  compact?: boolean;
};

export function AlertasPanel({ title = "Alertas operativas", categories, limit = 12, compact }: Props) {
  const { bodegaId, isGlobal } = useActiveBodega();
  const fn = useServerFn(getAlertas);
  const q = useQuery({
    queryKey: ["alertas", bodegaId, isGlobal],
    queryFn: () => fn({ data: { bodegaId: bodegaId ?? null, global: isGlobal } }),
    enabled: !!bodegaId || isGlobal,
    staleTime: 30_000,
  });

  const all = (q.data ?? []) as Alerta[];
  const filtered = categories ? all.filter((a) => categories.includes(a.category)) : all;
  const items = filtered.slice(0, limit);

  if (q.isLoading) {
    return <div className="text-xs text-muted-foreground">Cargando alertas…</div>;
  }
  if (!items.length) {
    return compact ? null : (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
        <div className="font-medium text-foreground mb-1">{title}</div>
        Sin alertas activas.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{filtered.length} activa(s)</div>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {items.map((a) => {
          const s = SEV[a.severity];
          const row = (
            <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
              <span
                className="mt-0.5 inline-flex items-center justify-center size-6 rounded-md shrink-0"
                style={{ background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}
              >
                <s.Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground truncate">{a.title}</div>
                {a.detail && (
                  <div className="text-[11px] text-muted-foreground truncate">{a.detail}</div>
                )}
              </div>
              {a.href && <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
            </div>
          );
          return (
            <li key={a.id} style={{ borderColor: "var(--border)" }}>
              {a.href ? (
                <Link to={a.href as any} className="block">{row}</Link>
              ) : row}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
