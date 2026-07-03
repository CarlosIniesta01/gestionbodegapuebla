import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MapToolbar } from "./MapToolbar";
import { DepositoNode } from "./DepositoNode";
import { ZonaContainer } from "./ZonaContainer";
import { DepositoPanel } from "./DepositoPanel";
import { EditZonaDialog } from "./EditZonaDialog";
import { EditDepositoDialog } from "./EditDepositoDialog";
import { TrabajoFormDialog } from "./TrabajoFormDialog";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { listTrabajos } from "@/lib/api/trabajos.functions";
import { listExistencias } from "@/lib/api/movimientos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";
import type { TrabajoTipo } from "@/lib/trabajo-meta";
import { CANVAS_H, CANVAS_W, type Deposito, type Zona } from "@/lib/bodega-data";

import { useColorSettings } from "@/lib/use-color-settings";


export function BodegaCanvas({ bodegaId: bodegaIdProp }: { bodegaId?: string } = {}) {
  const active = useActiveBodega();
  const bodegaId = bodegaIdProp ?? active.bodegaId;
  const map = useBodegaMap(bodegaId);
  const navigate = useNavigate();
  const [quickTrabajo, setQuickTrabajo] = useState<{ open: boolean; tipo: TrabajoTipo; origen?: string; destino?: string }>({ open: false, tipo: "trasiego" });



  const listFn = useServerFn(listTrabajos);
  const trabajosQ = useQuery({
    queryKey: ["trabajos", bodegaId, "en_curso-map"],
    queryFn: () => listFn({ data: { bodegaId: bodegaId!, estado: ["en_curso"] } }),
    enabled: !!bodegaId,
    refetchInterval: 8000,
  });
  const enCurso: any[] = trabajosQ.data ?? [];

  const listExistFn = useServerFn(listExistencias);
  const listProdFn = useServerFn(listProductosComerciales);
  const existenciasQ = useQuery({
    queryKey: ["existencias", bodegaId, "map"],
    queryFn: () => listExistFn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
    refetchInterval: 10000,
  });
  const productosQ = useQuery({
    queryKey: ["productos-comerciales", bodegaId, "map"],
    queryFn: () => listProdFn({ data: { bodegaId: bodegaId! } }),
    enabled: !!bodegaId,
  });

  // Resumen por depósito desde existencias_actuales (join por bodega_id + deposito_id + producto_id)
  const existenciaByDeposito = useMemo(() => {
    const productos = (productosQ.data ?? []) as any[];
    const prodById: Record<string, any> = Object.fromEntries(productos.map((p) => [p.id, p]));
    const rows = (existenciasQ.data ?? []) as any[];
    const acc: Record<string, {
      litros: number;
      alcohol_absoluto: number;
      grado_medio: number;
      lineas: { producto_id: string | null; nombre: string; litros: number; grado: number; aa: number }[];
    }> = {};
    rows.forEach((r) => {
      const did = r?.deposito_id;
      if (!did) return;
      const litros = Number(r?.litros ?? 0) || 0;
      const aa = Number(r?.alcohol_absoluto ?? 0) || 0;
      const grado = Number(r?.grado_medio ?? 0) || 0;
      const prod = r?.producto_id ? prodById[r.producto_id] : null;
      const entry = acc[did] ?? { litros: 0, alcohol_absoluto: 0, grado_medio: 0, lineas: [] };
      entry.litros += litros;
      entry.alcohol_absoluto += aa;
      entry.lineas.push({
        producto_id: r?.producto_id ?? null,
        nombre: prod?.nombre ?? "(sin producto)",
        litros,
        grado,
        aa,
      });
      acc[did] = entry;
    });
    Object.values(acc).forEach((e) => {
      e.grado_medio = e.litros > 0 ? (e.alcohol_absoluto * 100) / e.litros : 0;
    });
    return acc;
  }, [existenciasQ.data, productosQ.data]);

  const [editMode, setEditMode] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null);

  const [zonaDialog, setZonaDialog] = useState<{ open: boolean; zona: Zona | null }>({ open: false, zona: null });
  const [depDialog, setDepDialog] = useState<{ open: boolean; deposito: Deposito | null }>({ open: false, deposito: null });

  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedBase = map.depositos.find((d) => d.id === selectedDepId) ?? null;
  const existenciaSelected = selectedBase ? existenciaByDeposito[selectedBase.id] ?? null : null;
  const selectedEmpty = !existenciaSelected || existenciaSelected.litros <= 0.01;
  const selected = selectedBase
    ? {
        ...selectedBase,
        litros: existenciaSelected ? existenciaSelected.litros : (selectedEmpty ? 0 : selectedBase.litros),
        estado: selectedEmpty ? ("vacio" as any) : selectedBase.estado,
        contenido: selectedEmpty
          ? undefined
          : (existenciaSelected!.lineas.length === 1
              ? existenciaSelected!.lineas[0].nombre
              : existenciaSelected!.lineas.length > 1
                ? `${existenciaSelected!.lineas.length} productos`
                : selectedBase.contenido ?? undefined),
      }
    : null;
  const zonaSelected = selected ? map.zonas.find((z) => z.id === selected.zona_id) : null;

  // (trasiegos se calcula tras depositosLayout para usar posiciones auto-ordenadas)


  const depositosPorZona = useMemo(() => {
    const m: Record<string, number> = {};
    map.depositos.forEach((d) => { m[d.zona_id] = (m[d.zona_id] ?? 0) + 1; });
    return m;
  }, [map.depositos]);

  // Auto-layout: posiciona depósitos en grid dentro de su zona
  // y calcula las dimensiones efectivas de cada zona para que abarque sus depósitos.
  const { depositosLayout, zonasLayout } = useMemo(() => {
    const grupos = new Map<string, typeof map.depositos>();
    map.depositos.forEach((d) => {
      const arr = grupos.get(d.zona_id) ?? [];
      arr.push(d);
      grupos.set(d.zona_id, arr);
    });
    const deps: typeof map.depositos = [];
    const zonas = map.zonas.map((zona) => {
      const grupo = (grupos.get(zona.id) ?? []).slice()
        .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

      const padX = 16;
      const padTop = 44;
      const padBottom = 16;
      const minInner = 80;
      const maxRadio = grupo.length ? Math.max(...grupo.map((d) => d.radio)) : 24;
      const cellW = maxRadio * 2 + 14;
      const cellH = maxRadio * 2 + 14;

      // Cols: respeta ancho actual de la zona como referencia, pero garantiza al menos 1
      const usableW0 = Math.max(minInner, zona.ancho - padX * 2);
      const cols = Math.max(1, Math.min(grupo.length || 1, Math.floor(usableW0 / cellW) || 1));
      const rows = Math.max(1, Math.ceil((grupo.length || 1) / cols));

      // Dimensiones efectivas: ajusta para abarcar exactamente el grid
      const gridW = cols * cellW;
      const gridH = rows * cellH;
      const ancho = Math.max(zona.ancho, gridW + padX * 2);
      const alto = padTop + gridH + padBottom;

      const usableW = ancho - padX * 2;
      const offsetX = zona.pos_x + padX + Math.max(0, (usableW - gridW) / 2);
      const offsetY = zona.pos_y + padTop;

      grupo.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        deps.push({
          ...d,
          pos_x: offsetX + col * cellW + cellW / 2,
          pos_y: offsetY + row * cellH + cellH / 2,
        });
      });

      return { ...zona, ancho, alto };
    });
    return { depositosLayout: deps, zonasLayout: zonas };
  }, [map.depositos, map.zonas]);

  // Overlay litros desde existencias_actuales (fuente única de verdad)
  const depositosConExistencias: Deposito[] = useMemo(() => {
    return depositosLayout.map((d) => {
      const e = existenciaByDeposito[d.id];
      const litros = e?.litros ?? 0;
      // Sin existencias reales → estado y contenido se anulan, sin importar
      // el último estado heredado (vino, fermentacion, mosto, etc.).
      if (!e || litros <= 0.01) {
        return { ...d, litros: 0, contenido: undefined, estado: "vacio" as any };
      }
      const contenidoOverlay = e.lineas.length === 1
        ? e.lineas[0].nombre
        : e.lineas.length > 1
          ? `${e.lineas.length} productos`
          : d.contenido ?? undefined;
      return { ...d, litros: e.litros, contenido: contenidoOverlay ?? undefined };
    });
  }, [depositosLayout, existenciaByDeposito]);

  // Persistencia: sincroniza el mapa cuando un depósito quede sin existencias,
  // limpiando estado y contenido heredados (variedad, color, vino terminado…).
  // Solo escribe si el estado guardado difiere del derivado.
  useEffect(() => {
    if (!bodegaId) return;
    if (existenciasQ.isLoading || !existenciasQ.data) return;
    for (const d of map.depositos) {
      const e = existenciaByDeposito[d.id];
      const litros = e?.litros ?? 0;
      if (!e || litros <= 0.01) {
        const needsEstado = d.estado !== "vacio" && d.estado !== "limpieza";
        const needsContenido = !!(d.contenido && d.contenido.trim() !== "");
        const needsLitros = (d.litros ?? 0) > 0.01;
        if (needsEstado || needsContenido || needsLitros) {
          map.updateDeposito(d.id, {
            estado: "vacio" as any,
            contenido: "",
            litros: 0,
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, existenciasQ.data, existenciasQ.isLoading]);




  // Trasiegos activos: SOLO trabajos reales en curso (sin datos demo)
  const trasiegos = useMemo(() => {
    return enCurso
      .filter((t) => t.tipo === "trasiego" && t.estado === "en_curso" && t.deposito_origen && t.deposito_destino)
      .map((t) => {
        const o = depositosLayout.find((d) => d.codigo === t.deposito_origen);
        const dest = depositosLayout.find((d) => d.codigo === t.deposito_destino);
        return o && dest ? { id: t.id, o, d: dest, titulo: t.titulo ?? "" } : null;
      })
      .filter(Boolean) as { id: string; o: Deposito; d: Deposito; titulo: string }[];
  }, [depositosLayout, enCurso]);

  // Llenados activos (vendimia / producto sobre destino)
  const llenados = useMemo(() => {
    return enCurso
      .filter((t) => (t.tipo === "vendimia" || t.tipo === "producto") && t.deposito_destino)
      .map((t) => {
        const d = depositosLayout.find((x) => x.codigo === t.deposito_destino);
        return d ? { id: t.id, d, tipo: t.tipo as string } : null;
      })
      .filter(Boolean) as { id: string; d: Deposito; tipo: string }[];
  }, [depositosLayout, enCurso]);



  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)]">
        <MapToolbar
          editMode={editMode}
          onToggleEdit={() => setEditMode((v) => !v)}
          onAddZona={() => setZonaDialog({ open: true, zona: null })}
          onAddDeposito={() => setDepDialog({ open: true, deposito: null })}
          onReset={() => { if (confirm("¿Restablecer el mapa al estado inicial?")) map.resetMap(); }}
          zoom={zoom}
          onZoom={setZoom}
          procesosCount={trasiegos.length + llenados.length}
          zonasCount={map.zonas.length}
          depositosCount={map.depositos.length}
        />

        <div
          ref={scrollRef}
          className="relative flex-1 overflow-auto grid-bg"
          style={{ touchAction: editMode ? "none" : "auto" }}
        >
          <div
            className="relative origin-top-left"
            style={{
              width: CANVAS_W * zoom,
              height: CANVAS_H * zoom,
            }}
            onClick={() => setSelectedDepId(null)}
          >
            <div
              className="absolute top-0 left-0"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            >
              {/* Zones */}
              {zonasLayout.map((z) => (
                <div key={z.id} data-zona-root="1">
                  <ZonaContainer
                    zona={z}
                    count={depositosPorZona[z.id] ?? 0}
                    editMode={editMode}
                    scale={zoom}
                    onMoveEnd={(x, y) => map.moveZona(z.id, x, y)}
                    onEdit={() => setZonaDialog({ open: true, zona: z })}
                    onDelete={() => {
                      if (confirm(`Eliminar zona "${z.nombre}" y todos sus depósitos?`)) map.deleteZona(z.id);
                    }}
                  />
                </div>
              ))}

              {/* Trasiego flow lines + llenados activos */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ overflow: "visible" }}
              >
                <defs>
                  <marker id="arrowTrasiego" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 Z" fill="var(--state-trasiego)" />
                  </marker>
                </defs>
                {trasiegos.map((t) => {
                  const mx = (t.o.pos_x + t.d.pos_x) / 2;
                  const my = (t.o.pos_y + t.d.pos_y) / 2;
                  return (
                    <g key={t.id}>
                      <line
                        x1={t.o.pos_x} y1={t.o.pos_y} x2={t.d.pos_x} y2={t.d.pos_y}
                        stroke="var(--state-trasiego)" strokeWidth={2.5} opacity={0.3}
                      />
                      <line
                        x1={t.o.pos_x} y1={t.o.pos_y} x2={t.d.pos_x} y2={t.d.pos_y}
                        stroke="var(--state-trasiego)" strokeWidth={2.5} className="flow-dash"
                        markerEnd="url(#arrowTrasiego)"
                      />
                      <circle cx={t.o.pos_x} cy={t.o.pos_y} r={5} fill="var(--state-trasiego)" />
                      <circle cx={t.d.pos_x} cy={t.d.pos_y} r={4} fill="var(--state-trasiego)" />
                      <text x={mx} y={my - 8} textAnchor="middle" fontSize="10" fill="var(--state-trasiego)" style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}>
                        {t.o.codigo} → {t.d.codigo}
                      </text>
                    </g>
                  );
                })}
                {llenados.map((l) => (
                  <g key={l.id}>
                    <circle
                      cx={l.d.pos_x} cy={l.d.pos_y} r={l.d.radio + 10}
                      fill="var(--state-trasiego)" opacity={0.12}
                    />
                    <circle
                      cx={l.d.pos_x} cy={l.d.pos_y} r={l.d.radio + 6}
                      fill="none" stroke="var(--state-trasiego)" strokeWidth={2} opacity={0.85}
                    />
                  </g>
                ))}
              </svg>

              {/* Deposits — auto-arranged en línea dentro de cada zona */}
              {depositosConExistencias.map((d) => (
                <DepositoNode
                  key={d.id}
                  deposito={d}
                  selected={selectedDepId === d.id}
                  filling={llenados.some((l) => l.d.id === d.id)}
                  editMode={false /* posicionamiento automático: no arrastrable */}
                  scale={zoom}
                  onClick={() => {
                    if (editMode) setDepDialog({ open: true, deposito: d });
                    else setSelectedDepId(d.id);
                  }}
                />
              ))}

            </div>
          </div>

          {editMode && (
            <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md bg-card/95 backdrop-blur border border-primary/30 rounded-lg p-3 text-xs text-foreground shadow-md">
              <span className="font-semibold text-primary">Modo edición.</span>{" "}
              Arrastra zonas para reorganizarlas. Pulsa un depósito para editarlo. Los cambios se guardan en la bodega.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 border-t border-border bg-surface/60 text-[11px]">
          <LegendItems />
        </div>
      </div>


      <DepositoPanel
        deposito={selected}
        existencia={existenciaSelected}
        zonaName={zonaSelected?.nombre}
        bodegaId={bodegaId}
        onClose={() => setSelectedDepId(null)}
        onEdit={selected ? () => setDepDialog({ open: true, deposito: selected }) : undefined}

        onQuickAction={(action) => {
          if (!selected) return;
          if (action === "historial") {
            navigate({ to: "/trabajos" });
            return;
          }
          if (action === "trasiego") {
            setQuickTrabajo({ open: true, tipo: "trasiego", origen: selected.codigo });
          } else if (action === "limpieza") {
            setQuickTrabajo({ open: true, tipo: "limpieza", destino: selected.codigo });
          } else if (action === "producto") {
            setQuickTrabajo({ open: true, tipo: "producto", destino: selected.codigo });
          }
        }}
      />

      {bodegaId && (
        <TrabajoFormDialog
          open={quickTrabajo.open}
          onOpenChange={(v) => setQuickTrabajo((s) => ({ ...s, open: v }))}
          bodegaId={bodegaId}
          defaultTipo={quickTrabajo.tipo}
          defaultOrigen={quickTrabajo.origen}
          defaultDestino={quickTrabajo.destino}
        />
      )}


      <EditZonaDialog
        open={zonaDialog.open}
        onOpenChange={(v) => setZonaDialog((s) => ({ ...s, open: v }))}
        zona={zonaDialog.zona}
        onSave={(data) => {
          if (zonaDialog.zona) map.updateZona(zonaDialog.zona.id, data);
          else map.addZona(data.nombre, data.corto, data.color);
        }}
        onDelete={zonaDialog.zona ? () => map.deleteZona(zonaDialog.zona!.id) : undefined}
      />

      <EditDepositoDialog
        open={depDialog.open}
        onOpenChange={(v) => setDepDialog((s) => ({ ...s, open: v }))}
        deposito={depDialog.deposito}
        zonas={map.zonas}
        bodegaId={bodegaId}
        onSave={(data) => {
          if (depDialog.deposito) {
            map.updateDeposito(depDialog.deposito.id, data);
          } else {
            const id = map.addDeposito(data.zona_id, data.codigo, data.capacidad);
            map.updateDeposito(id, {
              litros: data.litros, estado: data.estado,
              contenido: data.contenido, radio: data.radio,
            });
          }
        }}
        onDelete={depDialog.deposito ? () => { map.deleteDeposito(depDialog.deposito!.id); setSelectedDepId(null); } : undefined}
      />
    </>
  );
}
function LegendItems() {
  const colors = useColorSettings();
  const estados = colors.getAllEstados();
  return (
    <>
      {estados.map((e) => (
        <div key={e.key} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2.5 rounded-full ring-1 ring-border" style={{ background: e.color }} />
          <span className="text-foreground/80">{e.label}</span>
        </div>
      ))}
    </>
  );
}


