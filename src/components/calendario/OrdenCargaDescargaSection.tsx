import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, ArrowUp, ArrowDown, ClipboardCopy, AlertTriangle, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { listProcesosDoc } from "@/lib/api/procesos-doc.functions";
import { listPlantillasAnalitica } from "@/lib/api/plantillas-analitica.functions";
import { listLotes } from "@/lib/api/lotes.functions";
import { listAnaliticasEvento } from "@/lib/api/analiticas.functions";
import { PARAMETROS_ANALITICA } from "@/lib/api/analiticas.functions";

export type OrdenParam = {
  id?: string;
  parametro: string;
  valor: number | null;
  unidad: string;
  minimo: number | null;
  maximo: number | null;
  metodo: string;
  obligatorio: boolean;
  resultadoEstado: "conforme" | "no_conforme" | "pendiente";
  observaciones: string;
};

export type OrdenState = {
  procesoId: string | null;
  procesoCodigo: string | null;
  procesoVersion: string | null;
  loteId: string | null;
  plantillaId: string | null;
  parametros: OrdenParam[];
  autorizadoPor: string | null;
  motivoAutorizacion: string;
};

export function emptyParam(nombre = ""): OrdenParam {
  return {
    parametro: nombre,
    valor: null,
    unidad: "",
    minimo: null,
    maximo: null,
    metodo: "",
    obligatorio: false,
    resultadoEstado: "pendiente",
    observaciones: "",
  };
}

function autoEstado(p: OrdenParam): OrdenParam["resultadoEstado"] {
  if (p.valor == null) return p.resultadoEstado;
  const min = p.minimo, max = p.maximo;
  if ((min != null && p.valor < min) || (max != null && p.valor > max)) return "no_conforme";
  if (min != null || max != null) return "conforme";
  return p.resultadoEstado;
}

interface Props {
  open: boolean;
  bodegaId: string;
  tipo: "carga" | "descarga";
  eventoId?: string | null; // solo edición
  productoId?: string | null;
  depositoDestino?: string | null;
  state: OrdenState;
  onChange: (patch: Partial<OrdenState>) => void;
  isEdit: boolean;
}

export function OrdenCargaDescargaSection({
  open, bodegaId, tipo, eventoId, productoId, depositoDestino, state, onChange, isEdit,
}: Props) {
  const fnProc = useServerFn(listProcesosDoc);
  const fnPlant = useServerFn(listPlantillasAnalitica);
  const fnLotes = useServerFn(listLotes);
  const fnEvAnalit = useServerFn(listAnaliticasEvento);

  const procesosQ = useQuery({
    queryKey: ["procesos-doc", bodegaId, tipo],
    queryFn: () => fnProc({ data: { bodegaId, tipo, soloActivos: true } }),
    enabled: open && !!bodegaId,
  });
  const plantillasQ = useQuery({
    queryKey: ["plantillas-analitica", bodegaId],
    queryFn: () => fnPlant({ data: { bodegaId, soloActivas: true } }),
    enabled: open && !!bodegaId && tipo === "descarga",
  });
  const lotesQ = useQuery({
    queryKey: ["lotes-picker", bodegaId],
    queryFn: () => fnLotes({ data: { bodegaId } }),
    enabled: open && !!bodegaId && tipo === "descarga",
  });

  // Cargar analíticas existentes cuando editamos
  const analitEventoQ = useQuery({
    queryKey: ["analiticas-evento", eventoId],
    queryFn: () => fnEvAnalit({ data: { eventoId: eventoId! } }),
    enabled: open && !!eventoId && tipo === "descarga" && isEdit,
  });

  // Hidratar parámetros desde el evento existente una única vez
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isEdit || tipo !== "descarga") return;
    if (hydratedRef.current) return;
    if (analitEventoQ.data && analitEventoQ.data.length && !state.parametros.length) {
      hydratedRef.current = true;
      const rows: OrdenParam[] = (analitEventoQ.data as any[])
        .sort((a, b) => (a.orden_num ?? 0) - (b.orden_num ?? 0))
        .map((r) => ({
          id: r.id,
          parametro: r.parametro,
          valor: r.valor != null ? Number(r.valor) : null,
          unidad: r.unidad ?? "",
          minimo: r.minimo != null ? Number(r.minimo) : null,
          maximo: r.maximo != null ? Number(r.maximo) : null,
          metodo: r.metodo ?? "",
          obligatorio: !!r.obligatorio,
          resultadoEstado: r.resultado_estado,
          observaciones: r.observaciones ?? "",
        }));
      const plantillaId = (analitEventoQ.data as any[])[0]?.plantilla_id ?? null;
      const loteId = (analitEventoQ.data as any[])[0]?.lote_id ?? null;
      onChange({ parametros: rows, plantillaId, loteId });
    }
  }, [analitEventoQ.data, isEdit, tipo, state.parametros.length, onChange]);

  // Autoseleccionar proceso por defecto en creación
  React.useEffect(() => {
    if (isEdit) return;
    if (state.procesoId) return;
    const list = procesosQ.data ?? [];
    if (!list.length) return;
    const def = list.find((p: any) => p.es_default) ?? list[0];
    onChange({
      procesoId: def.id,
      procesoCodigo: def.codigo,
      procesoVersion: def.version,
    });
  }, [procesosQ.data, isEdit, state.procesoId, onChange]);

  const procesos = procesosQ.data ?? [];
  const plantillas = (plantillasQ.data ?? []) as any[];

  const currentProc = procesos.find((p: any) => p.id === state.procesoId);
  const currentPlant = plantillas.find((p) => p.id === state.plantillaId);

  const parametrosBloqueantes = state.parametros.filter(
    (p) => p.obligatorio && (p.resultadoEstado !== "conforme"),
  );

  function setParam(idx: number, patch: Partial<OrdenParam>) {
    const next = state.parametros.slice();
    next[idx] = { ...next[idx], ...patch };
    next[idx].resultadoEstado = autoEstado(next[idx]);
    onChange({ parametros: next });
  }
  function addParam() {
    onChange({ parametros: [...state.parametros, emptyParam()] });
  }
  function removeParam(idx: number) {
    const next = state.parametros.slice();
    next.splice(idx, 1);
    onChange({ parametros: next });
  }
  function duplicateParam(idx: number) {
    const next = state.parametros.slice();
    next.splice(idx + 1, 0, { ...next[idx], id: undefined });
    onChange({ parametros: next });
  }
  function moveParam(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= state.parametros.length) return;
    const next = state.parametros.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ parametros: next });
  }
  function loadPlantilla(id: string) {
    const p = plantillas.find((x) => x.id === id);
    if (!p) return;
    const params: OrdenParam[] = (p.parametros ?? [])
      .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((x: any) => ({
        parametro: x.parametro,
        valor: null,
        unidad: x.unidad ?? "",
        minimo: x.minimo != null ? Number(x.minimo) : null,
        maximo: x.maximo != null ? Number(x.maximo) : null,
        metodo: x.metodo ?? "",
        obligatorio: !!x.obligatorio,
        resultadoEstado: "pendiente",
        observaciones: "",
      }));
    onChange({ plantillaId: id, parametros: params });
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {tipo === "carga" ? "Orden de carga · procedimiento" : "Orden de descarga · procedimiento y analítica"}
      </div>

      {/* Proceso documental */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nº Proceso</Label>
          <Select
            value={state.procesoId ?? "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") {
                onChange({ procesoId: null, procesoCodigo: null, procesoVersion: null });
              } else {
                const p = procesos.find((x: any) => x.id === v);
                onChange({
                  procesoId: v,
                  procesoCodigo: p?.codigo ?? null,
                  procesoVersion: p?.version ?? null,
                });
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar proceso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sin proceso —</SelectItem>
              {procesos.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.codigo} · v{p.version} · {p.nombre}
                  {p.es_default ? " · (predeterminado)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentProc?.descripcion ? (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{currentProc.descripcion}</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Snapshot</Label>
          <div className="text-xs px-2 py-2 rounded-md border border-border bg-muted/40">
            {state.procesoCodigo ? (
              <>
                <span className="font-medium">{state.procesoCodigo}</span>{" "}
                <span className="text-muted-foreground">v{state.procesoVersion}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Sin proceso seleccionado</span>
            )}
          </div>
        </div>
      </div>

      {tipo === "descarga" && (
        <>
          {/* Lote y plantilla */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lote asociado a la descarga</Label>
              <Select
                value={state.loteId ?? "__none__"}
                onValueChange={(v) => onChange({ loteId: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin lote —</SelectItem>
                  {(lotesQ.data ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.numero_lote ?? l.id.slice(0, 8)} · {l.productos?.nombre ?? "producto"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Requerido para registrar las analíticas en el historial del lote.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plantilla analítica</Label>
              <div className="flex gap-2">
                <Select
                  value={state.plantillaId ?? "__none__"}
                  onValueChange={(v) => (v === "__none__" ? onChange({ plantillaId: null }) : loadPlantilla(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Cargar plantilla" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin plantilla —</SelectItem>
                    {plantillas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}{p.es_default ? " · (predeterminada)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentPlant?.descripcion ? (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{currentPlant.descripcion}</p>
              ) : null}
            </div>
          </div>

          {/* Tabla dinámica de parámetros */}
          <div className="mt-3 rounded-md border border-border overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-muted/50">
              <span className="text-xs font-medium">Parámetros analíticos ({state.parametros.length})</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" type="button" onClick={addParam}>
                  <Plus className="size-3.5 mr-1" /> Añadir parámetro
                </Button>
              </div>
            </div>
            {state.parametros.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                Sin parámetros. Carga una plantilla o añade uno manualmente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-muted-foreground bg-muted/30">
                    <tr>
                      <th className="text-left py-1 px-1.5 w-8">#</th>
                      <th className="text-left py-1 px-1.5">Parámetro</th>
                      <th className="text-right py-1 px-1.5 w-20">Valor</th>
                      <th className="text-left py-1 px-1.5 w-16">Ud.</th>
                      <th className="text-right py-1 px-1.5 w-16">Mín</th>
                      <th className="text-right py-1 px-1.5 w-16">Máx</th>
                      <th className="text-center py-1 px-1.5 w-9" title="Obligatorio">Obl.</th>
                      <th className="text-left py-1 px-1.5 w-28">Estado</th>
                      <th className="text-left py-1 px-1.5">Observaciones</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.parametros.map((p, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-1 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="px-1 py-1">
                          <Input
                            list="param-suggest"
                            value={p.parametro}
                            onChange={(e) => setParam(i, { parametro: e.target.value })}
                            className="h-7 text-[11px]"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number" step="any"
                            value={p.valor ?? ""}
                            onChange={(e) => setParam(i, { valor: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-7 text-[11px] text-right"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input value={p.unidad} onChange={(e) => setParam(i, { unidad: e.target.value })} className="h-7 text-[11px]" />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number" step="any"
                            value={p.minimo ?? ""}
                            onChange={(e) => setParam(i, { minimo: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-7 text-[11px] text-right"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number" step="any"
                            value={p.maximo ?? ""}
                            onChange={(e) => setParam(i, { maximo: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-7 text-[11px] text-right"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <Checkbox
                            checked={p.obligatorio}
                            onCheckedChange={(v) => setParam(i, { obligatorio: !!v })}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={p.resultadoEstado}
                            onValueChange={(v) => setParam(i, { resultadoEstado: v as any })}
                          >
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendiente">Pendiente</SelectItem>
                              <SelectItem value="conforme">Conforme</SelectItem>
                              <SelectItem value="no_conforme">No conforme</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Input value={p.observaciones} onChange={(e) => setParam(i, { observaciones: e.target.value })} className="h-7 text-[11px]" />
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex gap-0.5 justify-end">
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveParam(i, -1)} title="Subir">
                              <ArrowUp className="size-3" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveParam(i, 1)} title="Bajar">
                              <ArrowDown className="size-3" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => duplicateParam(i)} title="Duplicar">
                              <ClipboardCopy className="size-3" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeParam(i)} title="Eliminar">
                              <Trash2 className="size-3 text-state-incidencia" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <datalist id="param-suggest">
              {PARAMETROS_ANALITICA.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          {/* Validación y autorización excepcional */}
          {parametrosBloqueantes.length > 0 && (
            <div className="mt-3 p-3 rounded-md border border-state-incidencia/40 bg-state-incidencia/10 text-xs">
              <div className="flex items-center gap-2 font-medium text-state-incidencia mb-1">
                <AlertTriangle className="size-4" />
                {parametrosBloqueantes.length} parámetro(s) obligatorio(s) pendiente(s) o no conforme(s)
              </div>
              <ul className="pl-5 list-disc space-y-0.5">
                {parametrosBloqueantes.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">{p.parametro || "(sin nombre)"}</span>
                    {" · "}
                    <Badge variant="outline" className="text-[10px]">{p.resultadoEstado}</Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <Label className="text-[11px] text-muted-foreground">Autorización excepcional (Enólogo / Laboratorio)</Label>
                <Input
                  value={state.motivoAutorizacion}
                  onChange={(e) => onChange({ motivoAutorizacion: e.target.value })}
                  placeholder="Motivo de la autorización excepcional…"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => printOrden({ tipo, state, depositoDestino: depositoDestino ?? null, productoId: productoId ?? null })}
              disabled={!state.procesoCodigo && !state.parametros.length}
            >
              <Printer className="size-3.5 mr-1" /> Imprimir orden
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function printOrden(args: { tipo: "carga" | "descarga"; state: OrdenState; depositoDestino: string | null; productoId: string | null }) {
  const { tipo, state } = args;
  const paramsHtml = state.parametros
    .map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.parametro)}</td>
        <td class="num">${p.valor ?? ""}</td>
        <td>${escapeHtml(p.unidad ?? "")}</td>
        <td class="num">${p.minimo ?? ""}</td>
        <td class="num">${p.maximo ?? ""}</td>
        <td>${p.resultadoEstado}</td>
        <td>${escapeHtml(p.observaciones ?? "")}</td>
      </tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Orden ${tipo}</title>
    <style>
      @page { size: A4; margin: 18mm 14mm; }
      body { font-family: -apple-system, sans-serif; color: #111; font-size: 11px; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      .meta { color: #555; font-size: 10px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
      th { background: #f4f4f5; font-weight: 600; }
      td.num { text-align: right; }
      .box { border: 1px solid #ddd; padding: 8px 10px; border-radius: 4px; margin-bottom: 10px; }
    </style></head><body>
    <h1>Orden de ${tipo === "carga" ? "Carga" : "Descarga"}</h1>
    <div class="meta">Nº Proceso: <b>${escapeHtml(state.procesoCodigo ?? "—")}</b>${state.procesoVersion ? ` · v${escapeHtml(state.procesoVersion)}` : ""} · Fecha: ${new Date().toLocaleString("es-ES")}</div>
    ${tipo === "descarga" ? `
      <div class="box"><b>Analítica de descarga (${state.parametros.length} parámetro${state.parametros.length === 1 ? "" : "s"})</b></div>
      <table>
        <thead><tr><th>#</th><th>Parámetro</th><th>Valor</th><th>Ud.</th><th>Mín</th><th>Máx</th><th>Estado</th><th>Observaciones</th></tr></thead>
        <tbody>${paramsHtml || `<tr><td colspan="8" style="text-align:center;color:#888">Sin parámetros</td></tr>`}</tbody>
      </table>
      ${state.motivoAutorizacion ? `<div class="box" style="margin-top:10px"><b>Autorización excepcional:</b> ${escapeHtml(state.motivoAutorizacion)}</div>` : ""}
    ` : ""}
  </body></html>`;
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(html); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignore */ } }, 200);
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any
  )[c]);
}
