import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MapToolbar } from "./MapToolbar";
import { DepositoNode } from "./DepositoNode";
import { ZonaContainer } from "./ZonaContainer";
import { DepositoPanel } from "./DepositoPanel";
import { EditZonaDialog } from "./EditZonaDialog";
import { EditDepositoDialog } from "./EditDepositoDialog";
import { useBodegaMap } from "@/lib/use-bodega-map";
import { CANVAS_H, CANVAS_W, ESTADO_META, PROCESOS_ACTIVOS, type Deposito, type Zona } from "@/lib/bodega-data";

export function BodegaCanvas() {
  const map = useBodegaMap();
  const [editMode, setEditMode] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null);

  const [zonaDialog, setZonaDialog] = useState<{ open: boolean; zona: Zona | null }>({ open: false, zona: null });
  const [depDialog, setDepDialog] = useState<{ open: boolean; deposito: Deposito | null }>({ open: false, deposito: null });

  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = map.depositos.find((d) => d.id === selectedDepId) ?? null;
  const zonaSelected = selected ? map.zonas.find((z) => z.id === selected.zona_id) : null;

  // Active trasiego lines (lookup by codigo)
  const trasiegos = useMemo(() => {
    return PROCESOS_ACTIVOS
      .filter((p) => p.tipo === "trasiego" && p.origen_codigo && p.destino_codigo)
      .map((p) => {
        const o = map.depositos.find((d) => d.codigo === p.origen_codigo);
        const d = map.depositos.find((d) => d.codigo === p.destino_codigo);
        return o && d ? { id: p.id, o, d } : null;
      })
      .filter(Boolean) as { id: string; o: Deposito; d: Deposito }[];
  }, [map.depositos]);

  const depositosPorZona = useMemo(() => {
    const m: Record<string, number> = {};
    map.depositos.forEach((d) => { m[d.zona_id] = (m[d.zona_id] ?? 0) + 1; });
    return m;
  }, [map.depositos]);

  return (
    <>
      <div className="scada-panel overflow-hidden flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)]">
        <MapToolbar
          editMode={editMode}
          onToggleEdit={() => setEditMode((v) => !v)}
          onAddZona={() => setZonaDialog({ open: true, zona: null })}
          onAddDeposito={() => setDepDialog({ open: true, deposito: null })}
          onReset={() => { if (confirm("¿Restablecer el mapa al estado inicial?")) map.resetMap(); }}
          zoom={zoom}
          onZoom={setZoom}
          procesosCount={PROCESOS_ACTIVOS.length}
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
              {map.zonas.map((z) => (
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

              {/* Trasiego flow lines */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ overflow: "visible" }}
              >
                {trasiegos.map((t) => (
                  <g key={t.id}>
                    <line
                      x1={t.o.pos_x} y1={t.o.pos_y} x2={t.d.pos_x} y2={t.d.pos_y}
                      stroke="var(--state-trasiego)" strokeWidth={2.5} opacity={0.3}
                    />
                    <line
                      x1={t.o.pos_x} y1={t.o.pos_y} x2={t.d.pos_x} y2={t.d.pos_y}
                      stroke="var(--state-trasiego)" strokeWidth={2.5} className="flow-dash"
                    />
                    <circle cx={t.o.pos_x} cy={t.o.pos_y} r={4} fill="var(--state-trasiego)" />
                    <circle cx={t.d.pos_x} cy={t.d.pos_y} r={4} fill="var(--state-trasiego)" />
                  </g>
                ))}
              </svg>

              {/* Deposits */}
              {map.depositos.map((d) => (
                <DepositoNode
                  key={d.id}
                  deposito={d}
                  selected={selectedDepId === d.id}
                  editMode={editMode}
                  scale={zoom}
                  onClick={() => {
                    if (editMode) setDepDialog({ open: true, deposito: d });
                    else setSelectedDepId(d.id);
                  }}
                  onMoveEnd={(x, y) => map.moveDeposito(d.id, x, y)}
                />
              ))}
            </div>
          </div>

          {editMode && (
            <div className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-md bg-surface-elevated/95 backdrop-blur border border-accent/40 rounded-lg p-3 text-xs text-foreground shadow-glow">
              <span className="font-semibold text-accent">Modo edición.</span>{" "}
              Arrastra depósitos y zonas para reorganizarlos. Pulsa un depósito para editarlo. Los cambios se guardan en este dispositivo.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-2.5 border-t border-border text-[11px]">
          {Object.entries(ESTADO_META).map(([k, meta]) => (
            <div key={k} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </div>
          ))}
        </div>
      </div>

      <DepositoPanel
        deposito={selected}
        zonaName={zonaSelected?.nombre}
        onClose={() => setSelectedDepId(null)}
        onEdit={selected ? () => setDepDialog({ open: true, deposito: selected }) : undefined}
      />

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
        onSave={(data) => {
          if (depDialog.deposito) {
            map.updateDeposito(depDialog.deposito.id, data);
          } else {
            map.addDeposito(data.zona_id, data.codigo, data.capacidad);
            // After add, also set extra fields via updateDeposito? we set via setEstado etc; simpler: addDeposito already creates, then update by codigo
          }
        }}
        onDelete={depDialog.deposito ? () => { map.deleteDeposito(depDialog.deposito!.id); setSelectedDepId(null); } : undefined}
      />
    </>
  );
}
