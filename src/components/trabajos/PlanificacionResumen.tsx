import { PLANTILLAS_TRABAJO, type PlanificacionGuardada } from "@/lib/plantillas-trabajo";

/** Read-only: tolerates absent/unknown versions in historical work orders. */
export function PlanificacionResumen({ datos }: { datos: unknown }) {
  if (!datos || typeof datos !== "object" || !("planificacion" in datos)) return null;
  const raw = datos.planificacion;
  if (!raw || typeof raw !== "object" || !("plantilla_id" in raw) || typeof raw.plantilla_id !== "string" || !(raw.plantilla_id in PLANTILLAS_TRABAJO)) return null;
  const plan = raw as PlanificacionGuardada;
  const plantilla = PLANTILLAS_TRABAJO[plan.plantilla_id];
  if (plan.naturaleza !== "prevision" || !Array.isArray(plan.productos)) return null;
  return <section className="space-y-3 text-sm break-words" aria-label="Parámetros previstos">
    <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{plantilla.nombre} · v{plan.plantilla_version}</span><span>{Number(plan.litros_previstos).toLocaleString("es-ES")} L previstos</span></div>
    <dl className="space-y-2">{Object.entries(plan.parametros ?? {}).map(([key, p]) => <div key={key}><dt className="text-xs text-muted-foreground">{plantilla.campos.find((c) => c.key === key)?.label ?? key}</dt><dd className="whitespace-pre-wrap">{p.valor} {p.unidad}</dd></div>)}</dl>
    {plan.productos.length > 0 && <ul className="space-y-2">{plan.productos.map((p, i) => <li key={`${p.producto_id}-${i}`} className="border-t pt-2"><div className="font-medium">{p.producto_nombre} · lote {p.lote_numero ?? "—"}</div><div>{p.dosis} {p.unidad_dosis} · {Number(p.cantidad_prevista).toLocaleString("es-ES", { maximumSignificantDigits: 12 })} {p.unidad_cantidad} previstos</div>{p.densidad_kg_l && <div className="text-xs text-muted-foreground">Densidad: {p.densidad_kg_l} kg/L</div>}</li>)}</ul>}
  </section>;
}