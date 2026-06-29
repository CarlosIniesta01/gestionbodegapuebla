import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRightLeft, Beaker, Droplets, Hammer, PackageOpen, Sparkles, Truck, FlaskConical } from "lucide-react";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { CentroHeader } from "@/components/CentroHeader";
import { AlertasPanel } from "@/components/AlertasPanel";
import { listProcesos, type Proceso } from "@/lib/api/procesos.functions";

export const Route = createFileRoute("/_authenticated/procesos")({
  head: () => ({
    meta: [
      { title: "Procesos operativos · Vinea Control" },
      { name: "description", content: "Procesos operativos en curso por centro." },
    ],
  }),
  component: ProcesosPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">No encontrado.</div>,
});

const BUCKETS: { key: Proceso["bucket"]; label: string; Icon: any }[] = [
  { key: "recepcion",   label: "Recepción",   Icon: PackageOpen },
  { key: "trasiego",    label: "Trasiego",    Icon: ArrowRightLeft },
  { key: "mezcla",      label: "Mezcla",      Icon: FlaskConical },
  { key: "correccion",  label: "Corrección",  Icon: Beaker },
  { key: "limpieza",    label: "Limpieza",    Icon: Sparkles },
  { key: "embotellado", label: "Embotellado", Icon: Droplets },
  { key: "expedicion",  label: "Expedición",  Icon: Truck },
  { key: "otro",        label: "Otros",       Icon: Hammer },
];

function ProcesosPage() {
  const { bodegaId, isGlobal } = useActiveBodega();
  const fn = useServerFn(listProcesos);
  const q = useQuery({
    queryKey: ["procesos", bodegaId, isGlobal],
    queryFn: () => fn({ data: { bodegaId: bodegaId ?? null, global: isGlobal } }),
    enabled: !!bodegaId || isGlobal,
    staleTime: 30_000,
  });

  const [active, setActive] = useState<Proceso["bucket"] | "all">("all");

  const grouped = useMemo(() => {
    const items = (q.data ?? []) as Proceso[];
    const m = new Map<Proceso["bucket"], Proceso[]>();
    for (const p of items) {
      if (!m.has(p.bucket)) m.set(p.bucket, []);
      m.get(p.bucket)!.push(p);
    }
    return m;
  }, [q.data]);

  const visible = useMemo(() => {
    const items = (q.data ?? []) as Proceso[];
    return active === "all" ? items : items.filter((i) => i.bucket === active);
  }, [q.data, active]);

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto space-y-4">
      <CentroHeader showResumen={false} />

      <AlertasPanel title="Alertas operativas" limit={6} />

      <div className="rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
        <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-medium">Procesos operativos</h2>
          <div className="ml-auto flex flex-wrap gap-1">
            <Chip label="Todos" count={(q.data ?? []).length} active={active === "all"} onClick={() => setActive("all")} />
            {BUCKETS.map((b) => {
              const n = grouped.get(b.key)?.length ?? 0;
              if (!n) return null;
              return (
                <Chip
                  key={b.key}
                  label={b.label}
                  count={n}
                  active={active === b.key}
                  onClick={() => setActive(b.key)}
                  Icon={b.Icon}
                />
              );
            })}
          </div>
        </div>
        {q.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Sin procesos en curso.</div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {visible.map((p) => {
              const def = BUCKETS.find((b) => b.key === p.bucket) ?? BUCKETS[BUCKETS.length - 1];
              const Icon = def.Icon;
              return (
                <li key={p.id}>
                  <Link to={p.href as any} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <span className="inline-flex size-8 items-center justify-center rounded-md bg-secondary text-foreground shrink-0">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">
                        {def.label}{p.producto ? ` · ${p.producto}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {p.origen ? `Origen: ${p.origen}` : "—"}
                        {p.destino ? ` · Destino: ${p.destino}` : ""}
                        {p.titulo ? ` · ${p.titulo}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.estado}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString("es-ES") : ""}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Chip({ label, count, active, onClick, Icon }: { label: string; count: number; active: boolean; onClick: () => void; Icon?: any }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-secondary/50"
      }`}
    >
      {Icon && <Icon className="size-3.5" />}
      {label}
      <span className="opacity-70">· {count}</span>
    </button>
  );
}
