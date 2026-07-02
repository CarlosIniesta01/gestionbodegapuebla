import * as React from "react";
import {
  ClipboardCheck, Grape, FlaskConical, Beaker, Users, LineChart,
  ShieldCheck, GitBranch, Leaf, ArrowRightLeft, FileSignature, Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BLOCK_BY_ID, CATEGORIES, hasRoleForBlock, type BlockCategory } from "@/lib/informes/blocks";
import type { InformeConfig } from "@/lib/informes/profiles";
import type { TrazabilidadLoteDTO } from "@/lib/api/trazabilidad.functions";

const CATEGORY_ICONS: Record<BlockCategory, any> = {
  info: ClipboardCheck,
  procesos: FlaskConical,
  productos: Beaker,
  operarios: Users,
  analiticas: LineChart,
  auditoria: ShieldCheck,
  trazabilidad: GitBranch,
  sensibles: Leaf,
  visuales: Grape,
};

export type RendererCtx = {
  data: TrazabilidadLoteDTO | null | undefined;
  tipoLabel: string;
  fecha: string;
  roleKey?: string;
};

export function InformeRenderer({
  config, ctx,
}: { config: InformeConfig; ctx: RendererCtx }) {
  const enabledIds = Object.entries(config).filter(([, v]) => v).map(([k]) => k);

  const hidden = {
    proveedores: !!config["hide.proveedores"],
    marcas: !!config["hide.marcas"],
    lotes: !!config["hide.lotes"],
    costes: !!config["hide.costes"],
    protocolos: !!config["hide.protocolos"],
    observaciones: !!config["hide.observaciones"],
    operarios: !!config["hide.operarios"],
    analiticas: !!config["hide.analiticas"],
    anonimizar: !!config["hide.anonimizar"],
  };

  const hasPortada = enabledIds.includes("info.portada");
  const hasIndice = enabledIds.includes("vis.indice");
  const hasNumeracion = enabledIds.includes("vis.numeracion");
  const hasPie = enabledIds.includes("vis.pie");
  const hasLogo = enabledIds.includes("vis.logo");

  const activeCategories = CATEGORIES
    .filter((c) => c.key !== "sensibles" && c.key !== "visuales")
    .filter((c) => enabledIds.some((id) => BLOCK_BY_ID[id]?.category === c.key
      && !(c.key === "info" && id === "info.portada")));

  const pages: React.ReactNode[] = [];

  if (hasPortada) pages.push(<Portada key="portada" ctx={ctx} hasLogo={hasLogo} />);
  if (hasIndice) pages.push(
    <Indice key="indice" categories={activeCategories} ctx={ctx} hasLogo={hasLogo} />,
  );

  activeCategories.forEach((cat) => {
    const Icon = CATEGORY_ICONS[cat.key];
    pages.push(
      <SectionPage key={cat.key} titulo={cat.label} icon={Icon} ctx={ctx} hasLogo={hasLogo} hasPie={hasPie}>
        <CategoryContent category={cat.key} config={config} ctx={ctx} hidden={hidden} />
      </SectionPage>
    );
  });

  const hasFinal = ["vis.firmas", "vis.sellos", "vis.certificados", "vis.qr"].some((id) => enabledIds.includes(id));
  if (hasFinal) {
    pages.push(
      <SectionPage key="final" titulo="Validación" icon={ShieldCheck} ctx={ctx} hasLogo={hasLogo} hasPie={hasPie}>
        <ValidacionBlock config={config} ctx={ctx} />
      </SectionPage>
    );
  }

  const total = pages.length;

  return (
    <div className="informe-root space-y-6 print:space-y-0">
      {pages.map((page, idx) =>
        React.isValidElement(page)
          ? React.cloneElement(page as any, { pageN: idx + 1, total, hasNumeracion })
          : page
      )}
    </div>
  );
}

/* ---------------- Layouts ---------------- */

function BaseFrame({
  ctx, hasLogo, pageN, total, hasNumeracion, hasPie, titulo, icon: Icon, children,
}: any) {
  const bodega = ctx.data?.bodega;
  const lote = ctx.data?.lote;
  return (
    <article className="informe-page mx-auto bg-white text-slate-900 shadow-md print:shadow-none border border-slate-200 print:border-0">
      <header className="flex items-center justify-between px-10 py-6 border-b-2 border-emerald-700">
        <div className="flex items-center gap-3">
          {hasLogo && (
            <div className="size-10 rounded-md bg-emerald-700 text-white flex items-center justify-center font-display font-bold">V</div>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">Vinea Control</div>
            <div className="text-sm font-semibold">{bodega?.nombre ?? "Centro no seleccionado"}</div>
          </div>
        </div>
        <div className="text-right">
          <Badge className="bg-emerald-700 hover:bg-emerald-700 text-white uppercase tracking-wider text-[10px]">{ctx.tipoLabel}</Badge>
          <div className="text-[11px] text-slate-500 mt-1">Fecha: {ctx.fecha}</div>
          <div className="text-[11px] text-slate-500">Lote: {lote?.numero_lote ?? "—"}</div>
        </div>
      </header>

      <div className="px-10 py-8 min-h-[820px]">
        {titulo && Icon && (
          <div className="flex items-center gap-3 mb-6">
            <div className="size-9 rounded-md bg-emerald-50 flex items-center justify-center">
              <Icon className="size-5 text-emerald-700" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Sección</div>
              <h2 className="text-xl font-display font-semibold text-slate-800">{titulo}</h2>
            </div>
          </div>
        )}
        {children}
      </div>

      {(hasPie || hasNumeracion) && (
        <footer className="px-10 py-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <span>{hasPie ? "Vinea Control · Informe de trazabilidad" : ""}</span>
          {hasNumeracion && pageN && total && <span>Página {pageN} de {total}</span>}
        </footer>
      )}
    </article>
  );
}

function SectionPage(props: any) { return <BaseFrame {...props}>{props.children}</BaseFrame>; }

function Portada({ ctx, hasLogo, pageN, total, hasNumeracion }: any) {
  const lote = ctx.data?.lote;
  const bodega = ctx.data?.bodega;
  return (
    <BaseFrame ctx={ctx} hasLogo={hasLogo} pageN={pageN} total={total} hasNumeracion={hasNumeracion} hasPie>
      <div className="flex flex-col items-center justify-center text-center min-h-[720px]">
        <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-700 font-semibold">Vinea Control</div>
        <h1 className="text-4xl font-display font-bold mt-4">{ctx.tipoLabel}</h1>
        <div className="mt-6 text-lg font-medium text-slate-700">
          {lote?.productos?.nombre ?? "Producto"} · Lote {lote?.numero_lote ?? "—"}
        </div>
        <div className="mt-2 text-sm text-slate-500">{bodega?.nombre ?? "Centro"}</div>
        <div className="mt-10 text-xs text-slate-400">Emitido el {ctx.fecha}</div>
      </div>
    </BaseFrame>
  );
}

function Indice({ categories, ctx, hasLogo, pageN, total, hasNumeracion }: any) {
  return (
    <BaseFrame ctx={ctx} hasLogo={hasLogo} pageN={pageN} total={total} hasNumeracion={hasNumeracion} hasPie titulo="Índice" icon={ClipboardCheck}>
      <ol className="space-y-2 text-sm">
        {categories.map((c: any, i: number) => (
          <li key={c.key} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1">
            <span><span className="text-slate-400 mr-2">{String(i + 1).padStart(2, "0")}.</span>{c.label}</span>
          </li>
        ))}
      </ol>
    </BaseFrame>
  );
}

/* ---------------- Content por categoría ---------------- */

function CategoryContent({ category, config, ctx, hidden }: any) {
  const on = (id: string) => {
    if (!config[id]) return false;
    const b = BLOCK_BY_ID[id];
    if (!b) return false;
    if (!hasRoleForBlock(b, ctx.roleKey)) return "restricted" as const;
    return true;
  };
  const dto: TrazabilidadLoteDTO | null | undefined = ctx.data;

  if (category === "info") return <InfoContent on={on} dto={dto} />;
  if (category === "procesos") return <ProcesosContent on={on} dto={dto} hidden={hidden} />;
  if (category === "productos") return <ProductosContent on={on} dto={dto} hidden={hidden} />;
  if (category === "operarios") return <OperariosContent on={on} dto={dto} hidden={hidden} />;
  if (category === "analiticas") return <AnaliticasContent on={on} hidden={hidden} />;
  if (category === "auditoria") return <AuditoriaContent on={on} dto={dto} hidden={hidden} />;
  if (category === "trazabilidad") return <TrazaContent on={on} dto={dto} hidden={hidden} />;
  return null;
}

/* ---- Helpers de formato ---- */
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtNum = (n: any, digits = 2) =>
  n == null || n === "" ? "—" : Number(n).toLocaleString("es-ES", { maximumFractionDigits: digits });

function perfilNombre(dto: TrazabilidadLoteDTO | null | undefined, userId?: string | null, anonimizar?: boolean) {
  if (!userId) return "—";
  if (anonimizar) return `Usuario ${userId.slice(0, 6)}`;
  const p = dto?.perfiles?.find((x: any) => x.user_id === userId);
  return p?.nombre || p?.email || `Usuario ${userId.slice(0, 6)}`;
}

/* ---- Info general ---- */
function InfoContent({ on, dto }: any) {
  const lote = dto?.lote;
  const bodega = dto?.bodega;
  const primerConsumo = dto?.consumos?.[0];
  const ultimoConsumo = dto?.consumos?.[dto.consumos.length - 1];

  const items: Array<[string, React.ReactNode]> = [];
  const add = (id: string, label: string, value: any) => {
    const s = on(id); if (!s) return;
    items.push([label, s === "restricted" ? <Restricted /> : (value ?? <Dash />)]);
  };
  add("info.datos_lote", "Nº de lote", lote?.numero_lote);
  add("info.producto", "Producto", lote?.productos?.nombre);
  add("info.tipo", "Categoría / Tipo", lote?.productos?.categoria ?? lote?.productos?.tipo);
  add("info.estado", "Estado", lote?.estado);
  add("info.centro", "Centro", bodega?.nombre);
  add("info.campana", "Fecha recepción", fmtDate(lote?.fecha_recepcion));
  add("info.deposito_inicial", "Depósito inicial", primerConsumo?.deposito_id);
  add("info.deposito_actual", "Depósito último uso", ultimoConsumo?.deposito_id);
  add("info.volumen_inicial", "Cantidad inicial",
    lote?.cantidad_inicial != null ? `${fmtNum(lote.cantidad_inicial)} ${lote.unidad ?? ""}` : null);
  add("info.volumen_actual", "Cantidad disponible",
    lote?.cantidad_disponible != null ? `${fmtNum(lote.cantidad_disponible)} ${lote.unidad ?? ""}` : null);
  add("info.responsable", "Registrado por", perfilNombre(dto, lote?.created_by));
  return <Grid items={items} />;
}

/* ---- Procesos: hasta que exista un catálogo de procesos por lote, mostramos
       los eventos derivados de trabajos y movimientos etiquetándolos por tipo ---- */
function ProcesosContent({ on, dto }: any) {
  const procesos: Array<{ id: string; label: string; match?: (t: any) => boolean }> = [
    { id: "procesos.recepcion", label: "Recepción" },
    { id: "procesos.limpiezas", label: "Limpiezas", match: (t) => /limpieza|lavado/i.test(t.titulo ?? "") },
    { id: "procesos.sulfitado", label: "Sulfitado", match: (t) => /sulfit/i.test(t.titulo ?? "") },
    { id: "procesos.fermentacion", label: "Fermentación", match: (t) => /fermenta/i.test(t.titulo ?? "") },
    { id: "procesos.trasiegos", label: "Trasiegos", match: (t) => /trasieg/i.test(t.titulo ?? "") },
    { id: "procesos.mezclas", label: "Mezclas", match: (t) => /mezcla|coupage/i.test(t.titulo ?? "") },
    { id: "procesos.correcciones", label: "Correcciones", match: (t) => /correcci/i.test(t.titulo ?? "") },
    { id: "procesos.clarificaciones", label: "Clarificaciones", match: (t) => /clarific/i.test(t.titulo ?? "") },
    { id: "procesos.filtraciones", label: "Filtraciones", match: (t) => /filtra/i.test(t.titulo ?? "") },
    { id: "procesos.estabilizacion", label: "Estabilización", match: (t) => /estabiliza/i.test(t.titulo ?? "") },
    { id: "procesos.embotellado", label: "Embotellado", match: (t) => /embotella/i.test(t.titulo ?? "") },
    { id: "procesos.almacenamiento", label: "Almacenamiento", match: (t) => /almacen/i.test(t.titulo ?? "") },
    { id: "procesos.expedicion", label: "Expedición", match: (t) => /expedic|salida|envío/i.test(t.titulo ?? "") },
    { id: "procesos.incidencias", label: "Incidencias", match: (t) => /incidencia|desviaci/i.test(t.titulo ?? "") },
    { id: "procesos.mantenimientos", label: "Mantenimientos", match: (t) => /mantenimiento|revisi/i.test(t.titulo ?? "") },
  ];
  const visibles = procesos.filter((p) => on(p.id));
  if (!visibles.length) return <Empty>Sin procesos seleccionados.</Empty>;
  const trabajos = dto?.trabajos ?? [];

  return (
    <div className="space-y-4">
      {visibles.map((p) => {
        const rel = p.match ? trabajos.filter(p.match) : [];
        return (
          <Section key={p.id} titulo={p.label}>
            {on(p.id) === "restricted"
              ? <Restricted />
              : rel.length === 0
                ? <Empty>Sin registros vinculados al lote en esta fase.</Empty>
                : <TrabajosTable rows={rel} dto={dto} />}
          </Section>
        );
      })}
    </div>
  );
}

function TrabajosTable({ rows, dto }: any) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="bg-emerald-50 text-emerald-800">
        <tr>
          {["Fecha", "Título", "Estado", "Depósito", "Asignado"].map((h) => (
            <th key={h} className="border border-emerald-100 px-2 py-1.5 text-left">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((t: any) => (
          <tr key={t.id} className="border-b border-slate-100">
            <td className="px-2 py-1.5">{fmtDate(t.scheduled_at ?? t.created_at)}</td>
            <td className="px-2 py-1.5 font-medium">{t.titulo}</td>
            <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{t.estado}</Badge></td>
            <td className="px-2 py-1.5">{t.deposito_origen ?? "—"}{t.deposito_destino ? ` → ${t.deposito_destino}` : ""}</td>
            <td className="px-2 py-1.5">{perfilNombre(dto, t.asignado_a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- Productos enológicos ---- */
function ProductosContent({ on, dto, hidden }: any) {
  if (!on("productos.utilizados")) return <Empty>Selecciona "Productos utilizados" para incluir el listado.</Empty>;
  const lote = dto?.lote;
  const consumos: any[] = dto?.consumos ?? [];

  const cols: Array<{ key: string; label: string; render: (c: any) => React.ReactNode }> = [
    { key: "producto", label: "Producto", render: () => lote?.productos?.nombre ?? "—" },
  ];
  if (on("productos.funcion")) cols.push({ key: "func", label: "Función", render: () => lote?.productos?.tipo ?? "—" });
  if (on("productos.categoria")) cols.push({ key: "cat", label: "Categoría", render: () => lote?.productos?.categoria ?? "—" });
  if (on("productos.cantidades")) cols.push({ key: "qty", label: "Cantidad", render: (c) => `${fmtNum(c.cantidad)} ${c.unidad ?? ""}` });
  if (on("productos.lotes") && !hidden.lotes) cols.push({ key: "lote", label: "Lote", render: () => lote?.numero_lote ?? "—" });
  if (on("productos.caducidad")) cols.push({ key: "cad", label: "Caducidad", render: () => fmtDate(lote?.fecha_caducidad) });
  if (on("productos.proveedor") && !hidden.proveedores) cols.push({ key: "prov", label: "Proveedor", render: () => lote?.proveedor ?? "—" });
  if (on("productos.marca") && !hidden.marcas) cols.push({ key: "marca", label: "Marca", render: () => lote?.productos?.fabricante ?? "—" });
  if (on("productos.costes") && !hidden.costes) cols.push({
    key: "coste", label: "Coste",
    render: (c) => lote?.coste_unitario != null ? `${fmtNum(Number(c.cantidad) * Number(lote.coste_unitario))} €` : "—",
  });
  if (on("productos.autorizaciones")) cols.push({
    key: "aut", label: "Autorización",
    render: (c) => c.uso_caducado_autorizado
      ? <span className="text-amber-700">Uso caducado ✓ {perfilNombre(dto, c.autorizado_por)}</span>
      : "—",
  });
  cols.push({ key: "fecha", label: "Fecha", render: (c) => fmtDate(c.fecha) });
  cols.push({ key: "dep", label: "Depósito", render: (c) => c.deposito_id ?? "—" });

  return (
    <div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-emerald-50 text-emerald-800">
            {cols.map((c) => <th key={c.key} className="border border-emerald-100 px-2 py-1.5 text-left">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {consumos.length === 0 && (
            <tr><td colSpan={cols.length} className="border border-slate-200 px-2 py-6 text-center text-slate-400 italic">
              No hay consumos registrados vinculados al lote.
            </td></tr>
          )}
          {consumos.map((c) => (
            <tr key={c.id} className={c.anulado ? "line-through text-slate-400" : ""}>
              {cols.map((col) => (
                <td key={col.key} className="border border-slate-200 px-2 py-1.5">{col.render(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {consumos.length > 0 && on("productos.cantidades") && (
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td colSpan={cols.length} className="px-2 py-1.5 text-right">
                Total consumido: {fmtNum(consumos.filter(c => !c.anulado).reduce((s, c) => s + Number(c.cantidad), 0))} {lote?.unidad}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {(on("productos.costes") && hidden.costes) && <RestrictedNote what="costes" />}
    </div>
  );
}

/* ---- Operarios ---- */
function OperariosContent({ on, dto, hidden }: any) {
  if (hidden.operarios) return <Restricted what="operarios" />;
  const trabajadores: any[] = dto?.trabajadoresTrabajo ?? [];
  const consumos: any[] = dto?.consumos ?? [];
  const anon = hidden.anonimizar;

  const showLista = on("operarios.lista");
  const showResp = on("operarios.responsable");
  const showFechas = on("operarios.fechas");
  const showHoras = on("operarios.horas");
  const showObs = on("operarios.observaciones") && !hidden.observaciones;
  const showFirma = on("operarios.firma");

  const uniqueOperarios = new Map<string, any>();
  for (const t of trabajadores) if (t.trabajador_id) uniqueOperarios.set(t.trabajador_id, t);
  for (const c of consumos) if (c.trabajador_id && !uniqueOperarios.has(c.trabajador_id)) {
    uniqueOperarios.set(c.trabajador_id, { trabajador_id: c.trabajador_id, rol_en_trabajo: "Consumo", hora_inicio: c.created_at });
  }

  return (
    <div className="space-y-4">
      {showResp && (
        <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Responsable del lote</div>
          <div className="font-medium">{perfilNombre(dto, dto?.lote?.created_by, anon)}</div>
        </div>
      )}
      {showLista && (
        uniqueOperarios.size === 0 ? <Empty>Sin trabajadores participantes registrados.</Empty> :
          <table className="w-full text-xs border-collapse">
            <thead className="bg-emerald-50 text-emerald-800">
              <tr>
                <th className="border border-emerald-100 px-2 py-1.5 text-left">Operario</th>
                <th className="border border-emerald-100 px-2 py-1.5 text-left">Rol</th>
                {showFechas && <th className="border border-emerald-100 px-2 py-1.5 text-left">Inicio</th>}
                {showHoras && <th className="border border-emerald-100 px-2 py-1.5 text-left">Fin</th>}
                {showObs && <th className="border border-emerald-100 px-2 py-1.5 text-left">Observaciones</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from(uniqueOperarios.values()).map((t: any, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 px-2 py-1.5">{perfilNombre(dto, t.trabajador_id, anon)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{t.rol_en_trabajo ?? "—"}</td>
                  {showFechas && <td className="border border-slate-200 px-2 py-1.5">{fmtDateTime(t.hora_inicio)}</td>}
                  {showHoras && <td className="border border-slate-200 px-2 py-1.5">{fmtDateTime(t.hora_fin)}</td>}
                  {showObs && <td className="border border-slate-200 px-2 py-1.5">{t.observaciones ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
      )}
      {showFirma && (
        <div className="grid grid-cols-2 gap-8 mt-4">
          <SignatureBox rol="Responsable" />
          <SignatureBox rol="Operario" />
        </div>
      )}
    </div>
  );
}

/* ---- Analíticas ---- (aún sin origen de datos vinculado a lote) */
function AnaliticasContent({ on, hidden }: any) {
  if (hidden.analiticas) return <Restricted what="analíticas" />;
  if (!on("analiticas.mostrar") && !on("analiticas.parametros") && !on("analiticas.evolucion")
    && !on("analiticas.graficos") && !on("analiticas.observaciones"))
    return <Empty>Sin bloques de analíticas activos.</Empty>;
  return (
    <Empty>
      No hay analíticas registradas para este lote. (El módulo de analíticas por lote
      aún no está conectado; se añadirá cuando exista la tabla de origen.)
    </Empty>
  );
}

/* ---- Auditoría ---- */
function AuditoriaContent({ on, dto, hidden }: any) {
  const bloques = [
    { id: "auditoria.historial", label: "Historial completo" },
    { id: "auditoria.usuarios", label: "Usuarios" },
    { id: "auditoria.cambios", label: "Cambios" },
    { id: "auditoria.evidencias", label: "Evidencias" },
    { id: "auditoria.fechas", label: "Fechas" },
  ].filter((b) => on(b.id));
  if (!bloques.length) return <Empty>Sin bloques de auditoría activos.</Empty>;
  if (bloques.some(b => on(b.id) === "restricted"))
    return <Restricted what="auditoría (requiere rol admin/responsable)" />;

  const eventos: any[] = [
    ...(dto?.auditoriaLote ?? []),
    ...(dto?.auditoriaConsumos ?? []),
  ].sort((a: any, b: any) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  if (eventos.length === 0) return <Empty>Sin registros de auditoría para este lote.</Empty>;

  return (
    <table className="w-full text-xs border-collapse">
      <thead className="bg-emerald-50 text-emerald-800">
        <tr>
          <th className="border border-emerald-100 px-2 py-1.5 text-left">Fecha</th>
          <th className="border border-emerald-100 px-2 py-1.5 text-left">Acción</th>
          <th className="border border-emerald-100 px-2 py-1.5 text-left">Tabla</th>
          <th className="border border-emerald-100 px-2 py-1.5 text-left">Usuario</th>
        </tr>
      </thead>
      <tbody>
        {eventos.slice(0, 60).map((e) => (
          <tr key={e.id}>
            <td className="border border-slate-200 px-2 py-1.5">{fmtDateTime(e.created_at)}</td>
            <td className="border border-slate-200 px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{e.accion}</Badge></td>
            <td className="border border-slate-200 px-2 py-1.5">{e.tabla}</td>
            <td className="border border-slate-200 px-2 py-1.5">{perfilNombre(dto, e.user_id, hidden.anonimizar)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- Trazabilidad ---- */
function TrazaContent({ on, dto, hidden }: any) {
  const items = [
    { id: "traza.linea_temporal", label: "Línea temporal" },
    { id: "traza.arbol", label: "Árbol de procesos" },
    { id: "traza.movimientos", label: "Movimientos" },
    { id: "traza.trabajos", label: "Trabajos" },
    { id: "traza.contratos", label: "Contratos relacionados" },
    { id: "traza.productos", label: "Productos utilizados" },
    { id: "traza.lotes", label: "Lotes utilizados" },
    { id: "traza.caducidades", label: "Caducidades" },
    { id: "traza.depositos", label: "Depósitos" },
  ].filter((b) => on(b.id));
  if (!items.length) return <Empty>Sin bloques de trazabilidad activos.</Empty>;

  return (
    <div className="space-y-5">
      {items.map((b) => (
        <Section key={b.id} titulo={b.label}>
          {on(b.id) === "restricted" ? <Restricted /> : <TrazaBlock id={b.id} dto={dto} hidden={hidden} />}
        </Section>
      ))}
    </div>
  );
}

function TrazaBlock({ id, dto, hidden }: { id: string; dto: TrazabilidadLoteDTO | null | undefined; hidden: any }) {
  if (!dto) return <Empty>Sin datos.</Empty>;

  if (id === "traza.linea_temporal" || id === "traza.arbol") {
    const eventos: Array<{ fecha: string; tipo: string; label: string; icon: any }> = [];
    if (dto.lote?.fecha_recepcion) eventos.push({ fecha: dto.lote.fecha_recepcion, tipo: "Recepción", label: `Lote ${dto.lote.numero_lote} recibido`, icon: Warehouse });
    for (const c of dto.consumos ?? []) eventos.push({
      fecha: `${c.fecha}${c.hora ? "T" + c.hora : ""}`, tipo: "Consumo",
      label: `${fmtNum(c.cantidad)} ${c.unidad ?? ""} → depósito ${c.deposito_id ?? "—"}`, icon: Beaker,
    });
    for (const m of dto.movimientos ?? []) eventos.push({
      fecha: `${m.fecha}${m.hora ? "T" + m.hora : ""}`, tipo: m.tipo,
      label: `${m.tipo?.toUpperCase()} · ${fmtNum(m.litros)} L${m.deposito_destino_id ? " → " + m.deposito_destino_id : ""}`,
      icon: ArrowRightLeft,
    });
    for (const t of dto.trabajos ?? []) if (t.completed_at || t.scheduled_at) eventos.push({
      fecha: t.completed_at ?? t.scheduled_at, tipo: "Trabajo", label: t.titulo, icon: FileSignature,
    });
    eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!eventos.length) return <Empty>Sin eventos de trazabilidad.</Empty>;
    return (
      <ol className="border-l-2 border-emerald-200 ml-2 space-y-3">
        {eventos.map((e, i) => {
          const Icon = e.icon;
          return (
            <li key={i} className="relative pl-4">
              <span className="absolute -left-[9px] top-1 size-4 rounded-full bg-emerald-600 flex items-center justify-center">
                <Icon className="size-2.5 text-white" />
              </span>
              <div className="text-[11px] text-slate-500">{fmtDateTime(e.fecha)}</div>
              <div className="text-sm"><span className="font-medium">{e.tipo}:</span> {e.label}</div>
            </li>
          );
        })}
      </ol>
    );
  }

  if (id === "traza.movimientos") {
    const rows = dto.movimientos ?? [];
    if (!rows.length) return <Empty>Sin movimientos vinculados.</Empty>;
    return (
      <table className="w-full text-xs border-collapse">
        <thead className="bg-emerald-50 text-emerald-800">
          <tr>{["Fecha","Tipo","Origen","Destino","Litros","Grado","Estado"].map(h=>(
            <th key={h} className="border border-emerald-100 px-2 py-1.5 text-left">{h}</th>))}</tr>
        </thead>
        <tbody>{rows.map((m: any) => (
          <tr key={m.id}>
            <td className="border border-slate-200 px-2 py-1.5">{fmtDate(m.fecha)}</td>
            <td className="border border-slate-200 px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{m.tipo}</Badge></td>
            <td className="border border-slate-200 px-2 py-1.5">{m.deposito_origen_id ?? "—"}</td>
            <td className="border border-slate-200 px-2 py-1.5">{m.deposito_destino_id ?? "—"}</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(m.litros)}</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(m.grado)}</td>
            <td className="border border-slate-200 px-2 py-1.5">{m.estado_movimiento}</td>
          </tr>))}</tbody>
      </table>
    );
  }

  if (id === "traza.trabajos") {
    const rows = dto.trabajos ?? [];
    if (!rows.length) return <Empty>Sin trabajos vinculados.</Empty>;
    return <TrabajosTable rows={rows} dto={dto} />;
  }

  if (id === "traza.contratos") {
    if (hidden.protocolos) return <Restricted what="contratos" />;
    const c = dto.contratosCompra ?? []; const v = dto.contratosVenta ?? [];
    if (!c.length && !v.length) return <Empty>Sin contratos vinculados.</Empty>;
    return (
      <div className="space-y-3">
        {c.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Compras</div>
            <table className="w-full text-xs border-collapse">
              <thead className="bg-emerald-50 text-emerald-800"><tr>
                {["Nº","Proveedor","Campaña","L. contratados","L. retirados","Estado"].map(h=>(
                  <th key={h} className="border border-emerald-100 px-2 py-1.5 text-left">{h}</th>))}</tr></thead>
              <tbody>{c.map((r: any) => (
                <tr key={r.id}>
                  <td className="border border-slate-200 px-2 py-1.5">{r.numero_contrato}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{hidden.proveedores ? "—" : (r.proveedores?.nombre ?? "—")}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.campana ?? "—"}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(r.litros_contratados)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(r.litros_retirados)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.estado}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
        {v.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Ventas</div>
            <table className="w-full text-xs border-collapse">
              <thead className="bg-emerald-50 text-emerald-800"><tr>
                {["Nº","Cliente","Campaña","L. contratados","L. servidos","Estado"].map(h=>(
                  <th key={h} className="border border-emerald-100 px-2 py-1.5 text-left">{h}</th>))}</tr></thead>
              <tbody>{v.map((r: any) => (
                <tr key={r.id}>
                  <td className="border border-slate-200 px-2 py-1.5">{r.numero_contrato}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.clientes?.nombre ?? "—"}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.campana ?? "—"}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(r.litros_contratados)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(r.litros_servidos)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{r.estado}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (id === "traza.productos" || id === "traza.lotes") {
    const lote = dto.lote;
    return (
      <table className="w-full text-xs border-collapse">
        <thead className="bg-emerald-50 text-emerald-800"><tr>
          {["Producto","Lote","Caducidad","Estado","Cantidad inicial","Disponible"].map(h=>(
            <th key={h} className="border border-emerald-100 px-2 py-1.5 text-left">{h}</th>))}</tr></thead>
        <tbody><tr>
          <td className="border border-slate-200 px-2 py-1.5">{lote?.productos?.nombre ?? "—"}</td>
          <td className="border border-slate-200 px-2 py-1.5">{hidden.lotes ? "—" : lote?.numero_lote}</td>
          <td className="border border-slate-200 px-2 py-1.5">{fmtDate(lote?.fecha_caducidad)}</td>
          <td className="border border-slate-200 px-2 py-1.5">{lote?.estado}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(lote?.cantidad_inicial)} {lote?.unidad}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{fmtNum(lote?.cantidad_disponible)} {lote?.unidad}</td>
        </tr></tbody>
      </table>
    );
  }

  if (id === "traza.caducidades") {
    const l = dto.lote;
    const cad = l?.fecha_caducidad ? new Date(l.fecha_caducidad) : null;
    const now = new Date();
    const diasRest = cad ? Math.round((cad.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm">
        <div className="grid grid-cols-3 gap-4">
          <div><div className="text-[10px] uppercase text-slate-500">Recepción</div><div className="font-medium">{fmtDate(l?.fecha_recepcion)}</div></div>
          <div><div className="text-[10px] uppercase text-slate-500">Caducidad</div><div className="font-medium">{fmtDate(l?.fecha_caducidad)}</div></div>
          <div><div className="text-[10px] uppercase text-slate-500">Días restantes</div>
            <div className={`font-medium ${diasRest != null && diasRest < 30 ? "text-red-600" : "text-emerald-700"}`}>
              {diasRest == null ? "—" : diasRest < 0 ? `Caducado hace ${-diasRest} d` : `${diasRest} d`}
            </div></div>
        </div>
      </div>
    );
  }

  if (id === "traza.depositos") {
    const rows = dto.depositos ?? [];
    if (!rows.length) return <Empty>El lote no ha pasado por ningún depósito registrado.</Empty>;
    return (
      <div className="flex flex-wrap gap-2">
        {rows.map((d: string) => <Badge key={d} variant="outline" className="text-xs">{d}</Badge>)}
      </div>
    );
  }

  return <Empty>Sin datos.</Empty>;
}

/* ---- Validación final ---- */
function ValidacionBlock({ config, ctx }: any) {
  return (
    <div className="space-y-6">
      {config["vis.firmas"] && (
        <div className="grid grid-cols-2 gap-8">
          <SignatureBox rol="Responsable de bodega" />
          <SignatureBox rol="Enólogo / Auditor" />
        </div>
      )}
      {(config["vis.sellos"] || config["vis.certificados"]) && (
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
          {config["vis.sellos"] && <StampBox label="Sello" />}
          {config["vis.certificados"] && <StampBox label="Certificado" />}
        </div>
      )}
      {config["vis.qr"] && (
        <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
          <div className="size-24 border-2 border-slate-300 rounded grid place-items-center text-[10px] text-slate-400">QR</div>
          <div className="text-xs text-slate-500">
            Trazabilidad verificable · Lote {ctx.data?.lote?.numero_lote ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Primitives ---------------- */

function Grid({ items }: { items: Array<[string, React.ReactNode]> }) {
  if (!items.length) return <Empty>Sin campos activos en esta sección.</Empty>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map(([label, value], i) => (
        <div key={i} className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
          <div className="text-sm font-medium mt-0.5 text-slate-800">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700 font-semibold border-b border-emerald-100 pb-1 mb-3">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 italic">
      {children}
    </div>
  );
}

function Dash() { return <span className="text-slate-400">—</span>; }

function Restricted({ what }: { what?: string } = {}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Información restringida{what ? ` (${what})` : ""}.
    </div>
  );
}

function RestrictedNote({ what }: { what: string }) {
  return <div className="mt-2 text-[11px] text-amber-700 italic">Los {what} se han ocultado por configuración del informe.</div>;
}

function SignatureBox({ rol }: { rol: string }) {
  return (
    <div>
      <div className="h-16 border-b border-slate-400" />
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{rol}</div>
      <div className="text-[10px] text-slate-400">Nombre, firma y fecha</div>
    </div>
  );
}

function StampBox({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-slate-300 rounded-md h-24 grid place-items-center text-xs text-slate-400 uppercase tracking-wider">
      {label}
    </div>
  );
}
