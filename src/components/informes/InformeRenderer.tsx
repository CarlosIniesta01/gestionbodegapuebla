import * as React from "react";
import {
  ClipboardCheck, Grape, FlaskConical, Beaker, Users, LineChart,
  ShieldCheck, GitBranch, Leaf,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BLOCK_BY_ID, CATEGORIES, hasRoleForBlock, type BlockCategory } from "@/lib/informes/blocks";
import type { InformeConfig } from "@/lib/informes/profiles";

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
  lote: any;
  bodega: any;
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

  // Categorías con al menos un bloque activo (excluyendo "sensibles" y "visuales" que no rinden página)
  const activeCategories = CATEGORIES
    .filter((c) => c.key !== "sensibles" && c.key !== "visuales")
    .filter((c) => enabledIds.some((id) => BLOCK_BY_ID[id]?.category === c.key
      && !(c.key === "info" && id === "info.portada")));

  const pages: React.ReactNode[] = [];

  if (hasPortada) pages.push(
    <Portada key="portada" ctx={ctx} hasLogo={hasLogo} />,
  );

  if (hasIndice) pages.push(
    <Indice key="indice" categories={activeCategories} ctx={ctx} hasLogo={hasLogo} />,
  );

  activeCategories.forEach((cat) => {
    const Icon = CATEGORY_ICONS[cat.key];
    pages.push(
      <SectionPage
        key={cat.key}
        titulo={cat.label}
        icon={Icon}
        ctx={ctx}
        hasLogo={hasLogo}
        hasPie={hasPie}
      >
        <CategoryContent
          category={cat.key}
          config={config}
          ctx={ctx}
          hidden={hidden}
        />
      </SectionPage>
    );
  });

  // Firmas / sellos / certificados / QR → página final si alguno activo
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
}: {
  ctx: RendererCtx; hasLogo?: boolean; pageN?: number; total?: number;
  hasNumeracion?: boolean; hasPie?: boolean; titulo?: string; icon?: any;
  children: React.ReactNode;
}) {
  return (
    <article className="informe-page mx-auto bg-white text-slate-900 shadow-md print:shadow-none border border-slate-200 print:border-0">
      <header className="flex items-center justify-between px-10 py-6 border-b-2 border-emerald-700">
        <div className="flex items-center gap-3">
          {hasLogo && (
            <div className="size-10 rounded-md bg-emerald-700 text-white flex items-center justify-center font-display font-bold">V</div>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">Vinea Control</div>
            <div className="text-sm font-semibold">{ctx.bodega?.nombre ?? "Centro no seleccionado"}</div>
          </div>
        </div>
        <div className="text-right">
          <Badge className="bg-emerald-700 hover:bg-emerald-700 text-white uppercase tracking-wider text-[10px]">{ctx.tipoLabel}</Badge>
          <div className="text-[11px] text-slate-500 mt-1">Fecha: {ctx.fecha}</div>
          <div className="text-[11px] text-slate-500">Lote: {ctx.lote?.numero_lote ?? "—"}</div>
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

function SectionPage(props: any) {
  return <BaseFrame {...props}>{props.children}</BaseFrame>;
}

function Portada({ ctx, hasLogo, pageN, total, hasNumeracion }: any) {
  return (
    <BaseFrame ctx={ctx} hasLogo={hasLogo} pageN={pageN} total={total} hasNumeracion={hasNumeracion} hasPie>
      <div className="flex flex-col items-center justify-center text-center min-h-[720px]">
        <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-700 font-semibold">Vinea Control</div>
        <h1 className="text-4xl font-display font-bold mt-4">{ctx.tipoLabel}</h1>
        <div className="mt-6 text-lg font-medium text-slate-700">
          {ctx.lote?.productos?.nombre ?? "Producto"} · Lote {ctx.lote?.numero_lote ?? "—"}
        </div>
        <div className="mt-2 text-sm text-slate-500">{ctx.bodega?.nombre ?? "Centro"}</div>
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

function CategoryContent({
  category, config, ctx, hidden,
}: {
  category: BlockCategory;
  config: InformeConfig;
  ctx: RendererCtx;
  hidden: Record<string, boolean>;
}) {
  const on = (id: string) => {
    if (!config[id]) return false;
    const b = BLOCK_BY_ID[id];
    if (!b) return false;
    if (!hasRoleForBlock(b, ctx.roleKey)) return "restricted" as const;
    return true;
  };

  if (category === "info") return <InfoContent config={config} lote={ctx.lote} bodega={ctx.bodega} on={on} />;
  if (category === "procesos") return <ProcesosContent config={config} on={on} />;
  if (category === "productos") return <ProductosContent config={config} hidden={hidden} on={on} />;
  if (category === "operarios") return <OperariosContent config={config} hidden={hidden} on={on} />;
  if (category === "analiticas") return <AnaliticasContent config={config} hidden={hidden} on={on} />;
  if (category === "auditoria") return <AuditoriaContent config={config} on={on} />;
  if (category === "trazabilidad") return <TrazaContent config={config} lote={ctx.lote} hidden={hidden} on={on} />;
  return null;
}

/* ---- Info general ---- */
function InfoContent({ config, lote, bodega, on }: any) {
  const items: Array<[string, React.ReactNode]> = [];
  const add = (id: string, label: string, value: any) => {
    const s = on(id); if (!s) return;
    items.push([label, s === "restricted" ? <Restricted /> : (value ?? <Pending />)]);
  };
  add("info.datos_lote", "Nº de lote", lote?.numero_lote);
  add("info.producto", "Producto", lote?.productos?.nombre);
  add("info.tipo", "Categoría / Tipo", lote?.productos?.categoria);
  add("info.estado", "Estado", lote?.estado);
  add("info.centro", "Centro", bodega?.nombre);
  add("info.campana", "Campaña", null);
  add("info.deposito_inicial", "Depósito inicial", null);
  add("info.deposito_actual", "Depósito actual", null);
  add("info.volumen_inicial", "Volumen inicial", lote?.cantidad_inicial != null ? `${lote.cantidad_inicial} ${lote.unidad ?? ""}` : null);
  add("info.volumen_actual", "Volumen actual", lote?.cantidad_disponible != null ? `${lote.cantidad_disponible} ${lote.unidad ?? ""}` : null);
  add("info.responsable", "Responsable", null);
  return <Grid items={items} />;
}

/* ---- Procesos ---- */
function ProcesosContent({ config, on }: any) {
  const procesos: Array<{ id: string; label: string }> = [
    { id: "procesos.recepcion", label: "Recepción" },
    { id: "procesos.limpiezas", label: "Limpiezas" },
    { id: "procesos.sulfitado", label: "Sulfitado" },
    { id: "procesos.fermentacion", label: "Fermentación" },
    { id: "procesos.trasiegos", label: "Trasiegos" },
    { id: "procesos.mezclas", label: "Mezclas" },
    { id: "procesos.correcciones", label: "Correcciones" },
    { id: "procesos.clarificaciones", label: "Clarificaciones" },
    { id: "procesos.filtraciones", label: "Filtraciones" },
    { id: "procesos.estabilizacion", label: "Estabilización" },
    { id: "procesos.embotellado", label: "Embotellado" },
    { id: "procesos.almacenamiento", label: "Almacenamiento" },
    { id: "procesos.expedicion", label: "Expedición" },
    { id: "procesos.incidencias", label: "Incidencias" },
    { id: "procesos.mantenimientos", label: "Mantenimientos" },
  ];
  const visibles = procesos.filter((p) => on(p.id));
  if (!visibles.length) return <Empty>Sin procesos seleccionados.</Empty>;
  return (
    <div className="space-y-4">
      {visibles.map((p) => (
        <Section key={p.id} titulo={p.label}>
          {on(p.id) === "restricted" ? <Restricted /> : <Empty>Sin registros vinculados al lote en esta fase.</Empty>}
        </Section>
      ))}
    </div>
  );
}

/* ---- Productos enológicos ---- */
function ProductosContent({ config, hidden, on }: any) {
  if (!on("productos.utilizados")) return <Empty>Selecciona "Productos utilizados" para incluir el listado.</Empty>;
  const cols: string[] = ["Producto"];
  if (on("productos.funcion")) cols.push("Función");
  if (on("productos.categoria")) cols.push("Categoría");
  if (on("productos.cantidades")) cols.push("Cantidad");
  if (on("productos.lotes") && !hidden.lotes) cols.push("Lote");
  if (on("productos.caducidad")) cols.push("Caducidad");
  if (on("productos.proveedor") && !hidden.proveedores) cols.push("Proveedor");
  if (on("productos.marca") && !hidden.marcas) cols.push("Marca");
  if (on("productos.costes") && !hidden.costes) cols.push("Coste");
  if (on("productos.autorizaciones")) cols.push("Autorización");

  return (
    <div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-emerald-50 text-emerald-800">
            {cols.map((c) => <th key={c} className="border border-emerald-100 px-2 py-1.5 text-left">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={cols.length} className="border border-slate-200 px-2 py-6 text-center text-slate-400 italic">
              No hay consumos registrados vinculados al lote.
            </td>
          </tr>
        </tbody>
      </table>
      {(on("productos.costes") && hidden.costes) && <RestrictedNote what="costes" />}
    </div>
  );
}

/* ---- Operarios ---- */
function OperariosContent({ config, hidden, on }: any) {
  if (hidden.operarios) return <Restricted what="operarios" />;
  const items: Array<[string, React.ReactNode]> = [];
  if (on("operarios.responsable")) items.push(["Responsable", <Pending />]);
  if (on("operarios.lista")) items.push(["Operarios", <Pending />]);
  if (on("operarios.fechas")) items.push(["Fechas", <Pending />]);
  if (on("operarios.horas")) items.push(["Horas", <Pending />]);
  if (on("operarios.observaciones") && !hidden.observaciones) items.push(["Observaciones", <Pending />]);
  if (!items.length && !on("operarios.firma")) return <Empty>Sin bloques de operarios activos.</Empty>;
  return (
    <>
      <Grid items={items} />
      {on("operarios.firma") && (
        <div className="grid grid-cols-2 gap-8 mt-6">
          <SignatureBox rol="Responsable" />
          <SignatureBox rol="Operario" />
        </div>
      )}
    </>
  );
}

/* ---- Analíticas ---- */
function AnaliticasContent({ config, hidden, on }: any) {
  if (hidden.analiticas) return <Restricted what="analíticas" />;
  const items: Array<[string, React.ReactNode]> = [];
  if (on("analiticas.parametros")) items.push(["Parámetros", <Pending />]);
  if (on("analiticas.evolucion")) items.push(["Evolución", <Pending />]);
  if (on("analiticas.graficos")) items.push(["Gráficos", <Pending />]);
  if (on("analiticas.observaciones")) items.push(["Observaciones", <Pending />]);
  if (!items.length && !on("analiticas.mostrar")) return <Empty>Sin bloques de analíticas activos.</Empty>;
  return items.length ? <Grid items={items} /> : <Empty>Sin analíticas registradas para este lote.</Empty>;
}

/* ---- Auditoría ---- */
function AuditoriaContent({ config, on }: any) {
  const bloques = [
    { id: "auditoria.historial", label: "Historial" },
    { id: "auditoria.usuarios", label: "Usuarios" },
    { id: "auditoria.cambios", label: "Cambios" },
    { id: "auditoria.evidencias", label: "Evidencias" },
    { id: "auditoria.fechas", label: "Fechas" },
  ].filter((b) => on(b.id));
  if (!bloques.length) return <Empty>Sin bloques de auditoría activos.</Empty>;
  return (
    <div className="space-y-3">
      {bloques.map((b) => (
        <Section key={b.id} titulo={b.label}>
          {on(b.id) === "restricted" ? <Restricted /> : <Empty>Registros de auditoría pendientes de vincular al lote.</Empty>}
        </Section>
      ))}
    </div>
  );
}

/* ---- Trazabilidad ---- */
function TrazaContent({ config, lote, hidden, on }: any) {
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
    <div className="space-y-3">
      {items.map((b) => (
        <Section key={b.id} titulo={b.label}>
          {on(b.id) === "restricted" ? <Restricted /> : <Empty>Datos pendientes de vincular al lote {lote?.numero_lote ?? ""}.</Empty>}
        </Section>
      ))}
    </div>
  );
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
            Trazabilidad verificable · Lote {ctx.lote?.numero_lote ?? "—"}
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

function Pending() { return <span className="text-slate-400 italic">Pendiente</span>; }

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
