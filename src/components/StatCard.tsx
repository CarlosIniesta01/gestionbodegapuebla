import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
}

export function StatCard({ label, value, hint, icon: Icon, accent = "var(--accent)" }: Props) {
  return (
    <div className="scada-panel p-4 flex items-start gap-3">
      <div
        className="size-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: `color-mix(in oklab, ${accent} 18%, transparent)`,
          border: `1px solid color-mix(in oklab, ${accent} 50%, transparent)`,
        }}
      >
        <Icon className="size-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="text-2xl font-display font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
