import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Eye,
  Printer,
  EyeOff,
  Grape,
  Beaker,
  FlaskConical,
  ClipboardCheck,
  Leaf,
} from "lucide-react";

import { useActiveBodega } from "@/hooks/use-active-bodega";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { listLotes } from "@/lib/api/lotes.functions";

type TipoInforme = "interno" | "cliente" | "auditoria";

export const Route = createFileRoute("/_authenticated/informes")({
  head: () => ({
    meta: [
      { title: "Informes de trazabilidad · Vinea Control" },
      { name: "description", content: "Generador de informes de trazabilidad por lote." },
    ],
  }),
  component: InformesPage,
});

function InformesPage() {
  const { bodegaId, bodega, bodegas, setActiveBodegaId } = useActiveBodega();
  const [loteId, setLoteId] = React.useState<string | undefined>();
  const [tipo, setTipo] = React.useState<TipoInforme>("interno");
  const [ocultarSensibles, setOcultarSensibles] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);

  const listLotesFn = useServerFn(listLotes);
  const lotesQ = useQuery({
    queryKey: ["informes-lotes", bodegaId],
    queryFn: () => listLotesFn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });

  const lotes = lotesQ.data ?? [];
  const lote = React.useMemo(() => lotes.find((l: any) => l.id === loteId), [lotes, loteId]);

  const handlePrint = () => window.print();

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header — hidden on print */}
      <div className="print:hidden space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Informes de trazabilidad</h1>
            <p className="text-sm text-muted-foreground">Generador de informes por lote — Fase 1 (vista previa).</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Centro / Bodega</Label>
              <Select value={bodegaId ?? ""} onValueChange={(v) => setActiveBodegaId(v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona centro…" /></SelectTrigger>
                <SelectContent>
                  {(bodegas ?? []).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Lote</Label>
              <Select value={loteId ?? ""} onValueChange={setLoteId} disabled={!bodegaId || lotesQ.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={lotesQ.isLoading ? "Cargando lotes…" : "Selecciona lote…"} />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.numero_lote} — {l.productos?.nombre ?? "Producto"}
                    </SelectItem>
                  ))}
                  {lotes.length === 0 && !lotesQ.isLoading && (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No hay lotes registrados en este centro.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de informe</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInforme)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="auditoria">Auditoría</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="flex items-center justify-between w-full rounded-md border border-border px-3 py-2 bg-background">
                <div className="flex items-center gap-2">
                  <EyeOff className="size-4 text-muted-foreground" />
                  <Label htmlFor="ocultar" className="text-sm cursor-pointer">Ocultar datos sensibles</Label>
                </div>
                <Switch id="ocultar" checked={ocultarSensibles} onCheckedChange={setOcultarSensibles} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-border">
            <Button onClick={() => setShowPreview(true)} disabled={!loteId} className="gap-2">
              <Eye className="size-4" /> Vista previa
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!showPreview} className="gap-2">
              <Printer className="size-4" /> Imprimir (provisional)
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              La exportación PDF definitiva llegará en una próxima fase.
            </span>
          </div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && loteId && (
        <InformePreview
          lote={lote}
          bodega={bodega}
          tipo={tipo}
          ocultarSensibles={ocultarSensibles}
        />
      )}

      {!showPreview && (
        <div className="print:hidden rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <FileText className="size-10 mx-auto mb-3 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Selecciona un lote y pulsa <strong>Vista previa</strong> para generar el informe.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================ INFORME PREVIEW ============================ */

const TIPO_LABEL: Record<TipoInforme, string> = {
  interno: "INFORME INTERNO",
  cliente: "INFORME PARA CLIENTE",
  auditoria: "INFORME DE AUDITORÍA",
};

function InformePreview({
  lote, bodega, tipo, ocultarSensibles,
}: { lote: any; bodega: any; tipo: TipoInforme; ocultarSensibles: boolean }) {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="informe-root space-y-6 print:space-y-0">
      <Page n={1} total={5} bodega={bodega} tipo={tipo} fecha={fecha} lote={lote} icon={ClipboardCheck} titulo="Identificación del lote">
        <Grid>
          <Field label="Nº de lote" value={lote?.numero_lote} />
          <Field label="Producto" value={lote?.productos?.nombre} />
          <Field label="Categoría" value={lote?.productos?.categoria} />
          <Field label="Unidad" value={lote?.unidad} />
          <Field label="Fecha de recepción" value={lote?.fecha_recepcion} />
          <Field label="Fecha de caducidad" value={lote?.fecha_caducidad} />
          <Field label="Cantidad inicial" value={lote?.cantidad_inicial != null ? `${lote.cantidad_inicial} ${lote.unidad ?? ""}` : null} />
          <Field label="Cantidad disponible" value={lote?.cantidad_disponible != null ? `${lote.cantidad_disponible} ${lote.unidad ?? ""}` : null} />
          <Field label="Estado" value={lote?.estado} />
          <Field label="Ubicación" value={lote?.ubicacion} />
          <Field
            label="Proveedor"
            value={ocultarSensibles && tipo !== "interno" ? "—" : lote?.proveedor}
            sensible={ocultarSensibles && tipo !== "interno"}
          />
          <Field
            label="Coste unitario"
            value={ocultarSensibles ? "—" : (lote?.coste_unitario != null ? `${lote.coste_unitario} €` : null)}
            sensible={ocultarSensibles}
          />
        </Grid>
        <Note>Observaciones: {lote?.observaciones ?? "No registrado"}</Note>
      </Page>

      <Page n={2} total={5} bodega={bodega} tipo={tipo} fecha={fecha} lote={lote} icon={Grape} titulo="Recepción y preparación">
        <Grid>
          <Field label="Fecha de recepción" value={lote?.fecha_recepcion} />
          <Field label="Origen / procedencia" value={null} />
          <Field label="Variedad / composición" value={null} />
          <Field label="Grado inicial (°)" value={null} />
          <Field label="pH inicial" value={null} />
          <Field label="Acidez total (g/L)" value={null} />
          <Field label="Azúcares (g/L)" value={null} />
          <Field label="Temperatura de entrada (°C)" value={null} />
        </Grid>
        <Section titulo="Preparación previa">
          <Empty>Aún no hay preparaciones asociadas a este lote en el sistema.</Empty>
        </Section>
      </Page>

      <Page n={3} total={5} bodega={bodega} tipo={tipo} fecha={fecha} lote={lote} icon={FlaskConical} titulo="Fermentación">
        <Grid>
          <Field label="Depósito de fermentación" value={null} />
          <Field label="Fecha inicio" value={null} />
          <Field label="Fecha fin" value={null} />
          <Field label="Duración (días)" value={null} />
          <Field label="Temperatura media (°C)" value={null} />
          <Field label="Densidad inicial" value={null} />
          <Field label="Densidad final" value={null} />
          <Field label="Grado final (°)" value={null} />
        </Grid>
        <Section titulo="Controles diarios">
          <Empty>Sin registros de control en esta fase.</Empty>
        </Section>
      </Page>

      <Page n={4} total={5} bodega={bodega} tipo={tipo} fecha={fecha} lote={lote} icon={Beaker} titulo="Productos enológicos utilizados">
        <Section titulo="Consumos asociados">
          <Empty>Sin consumos vinculados al lote en esta fase.</Empty>
        </Section>
        <Note>
          En próximas fases se enlazarán aquí los consumos registrados en el Almacén Enológico,
          con producto, lote origen, cantidad, fecha, hora y trabajador responsable.
        </Note>
      </Page>

      <Page n={5} total={5} bodega={bodega} tipo={tipo} fecha={fecha} lote={lote} icon={Leaf} titulo="Resumen final de trazabilidad">
        <Grid>
          <Field label="Lote" value={lote?.numero_lote} />
          <Field label="Producto" value={lote?.productos?.nombre} />
          <Field label="Estado final" value={lote?.estado} />
          <Field label="Cantidad disponible" value={lote?.cantidad_disponible != null ? `${lote.cantidad_disponible} ${lote.unidad ?? ""}` : null} />
          <Field label="Fecha del informe" value={fecha} />
          <Field label="Tipo de informe" value={TIPO_LABEL[tipo]} />
        </Grid>
        <Section titulo="Firma y validación">
          <div className="grid grid-cols-2 gap-8 mt-6">
            <SignatureBox rol="Responsable de bodega" />
            <SignatureBox rol={tipo === "auditoria" ? "Auditor externo" : "Enólogo"} />
          </div>
        </Section>
        <Note>Documento generado electrónicamente por Vinea Control · Fase preliminar de trazabilidad.</Note>
      </Page>
    </div>
  );
}

/* ============================ BUILDING BLOCKS ============================ */

function Page({
  n, total, bodega, tipo, fecha, lote, titulo, icon: Icon, children,
}: {
  n: number; total: number; bodega: any; tipo: TipoInforme; fecha: string; lote: any;
  titulo: string; icon: any; children: React.ReactNode;
}) {
  return (
    <article className="informe-page mx-auto bg-white text-slate-900 shadow-md print:shadow-none border border-slate-200 print:border-0">
      <header className="flex items-center justify-between px-10 py-6 border-b-2 border-emerald-700">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-emerald-700 text-white flex items-center justify-center font-display font-bold">V</div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">Vinea Control</div>
            <div className="text-sm font-semibold">{bodega?.nombre ?? "Centro no seleccionado"}</div>
          </div>
        </div>
        <div className="text-right">
          <Badge className="bg-emerald-700 hover:bg-emerald-700 text-white uppercase tracking-wider text-[10px]">{TIPO_LABEL[tipo]}</Badge>
          <div className="text-[11px] text-slate-500 mt-1">Fecha: {fecha}</div>
          <div className="text-[11px] text-slate-500">Lote: {lote?.numero_lote ?? "—"}</div>
        </div>
      </header>

      <div className="px-10 py-8 min-h-[820px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-9 rounded-md bg-emerald-50 flex items-center justify-center">
            <Icon className="size-5 text-emerald-700" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Sección {n}</div>
            <h2 className="text-xl font-display font-semibold text-slate-800">{titulo}</h2>
          </div>
        </div>
        {children}
      </div>

      <footer className="px-10 py-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
        <span>Vinea Control · Informe de trazabilidad</span>
        <span>Página {n} de {total}</span>
      </footer>
    </article>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>;
}

function Field({ label, value, sensible }: { label: string; value: React.ReactNode; sensible?: boolean }) {
  const empty = value == null || value === "";
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${empty ? "text-slate-400 italic" : "text-slate-800"}`}>
        {sensible ? "Oculto" : empty ? "Pendiente" : value}
      </div>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
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

function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 text-[11px] text-slate-500 border-l-2 border-emerald-600 pl-3 leading-relaxed">{children}</div>;
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
