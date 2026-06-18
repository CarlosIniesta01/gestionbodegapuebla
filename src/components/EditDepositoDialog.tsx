import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { type Deposito, type DepositoEstado, type Zona } from "@/lib/bodega-data";
import { useColorSettings } from "@/lib/use-color-settings";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExistencias } from "@/lib/api/movimientos.functions";
import { listProductosComerciales } from "@/lib/api/productos-comerciales.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deposito: Deposito | null; // null = create
  zonas: Zona[];
  bodegaId?: string;
  onSave: (data: {
    codigo: string;
    zona_id: string;
    capacidad: number;
    litros: number;
    estado: DepositoEstado;
    contenido?: string;
    radio: number;
  }) => void;
  onDelete?: () => void;
}


export function EditDepositoDialog({ open, onOpenChange, deposito, zonas, bodegaId, onSave, onDelete }: Props) {
  const { getAllEstados } = useColorSettings();
  const estados = getAllEstados();

  const [codigo, setCodigo] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [capacidad, setCapacidad] = useState(20000);
  const [litros, setLitros] = useState(0);
  const [estado, setEstado] = useState<DepositoEstado>("vacio");
  const [contenido, setContenido] = useState("");
  const [radio, setRadio] = useState(24);

  const [capText, setCapText] = useState("");
  const [capFocus, setCapFocus] = useState(false);

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "");
    if (!d) return "";
    return Number(d).toLocaleString("es-ES");
  };

  // Fuente única de verdad: existencias_actuales (igual que el mapa/panel)
  const depositoId = deposito?.id;
  const listExistFn = useServerFn(listExistencias);
  const listProdFn = useServerFn(listProductosComerciales);
  const existenciasQ = useQuery({
    queryKey: ["existencias", bodegaId, "edit-dep", depositoId],
    queryFn: () => listExistFn({ data: { bodegaId: bodegaId! } }),
    enabled: open && !!bodegaId && !!depositoId,
    refetchInterval: open ? 8000 : false,
  });
  const productosQ = useQuery({
    queryKey: ["productos-comerciales", bodegaId, "edit-dep"],
    queryFn: () => listProdFn({ data: { bodegaId: bodegaId! } }),
    enabled: open && !!bodegaId,
  });

  const existencia = useMemo(() => {
    if (!depositoId) return null;
    const productos = (productosQ.data ?? []) as any[];
    const prodById: Record<string, any> = Object.fromEntries(productos.map((p) => [p.id, p]));
    const rows = ((existenciasQ.data ?? []) as any[]).filter((r) => r?.deposito_id === depositoId);
    if (!rows.length) return { litros: 0, alcohol_absoluto: 0, grado_medio: 0, lineas: [] as { nombre: string; litros: number; grado: number; aa: number }[] };
    let totL = 0, totAA = 0;
    const lineas = rows.map((r) => {
      const l = Number(r?.litros ?? 0) || 0;
      const aa = Number(r?.alcohol_absoluto ?? 0) || 0;
      const g = Number(r?.grado_medio ?? 0) || 0;
      totL += l; totAA += aa;
      const prod = r?.producto_id ? prodById[r.producto_id] : null;
      return { nombre: prod?.nombre ?? "(sin producto)", litros: l, grado: g, aa };
    });
    return { litros: totL, alcohol_absoluto: totAA, grado_medio: totL > 0 ? (totAA * 100) / totL : 0, lineas };
  }, [depositoId, existenciasQ.data, productosQ.data]);

  useEffect(() => {
    if (open) {
      setCodigo(deposito?.codigo ?? "");
      setZonaId(deposito?.zona_id ?? zonas[0]?.id ?? "");
      const cap = deposito?.capacidad ?? 20000;
      setCapacidad(cap);
      setCapText(cap === 0 ? "" : String(cap));
      setEstado(deposito?.estado ?? "vacio");
      setContenido(deposito?.contenido ?? "");
      setRadio(deposito?.radio ?? 24);
    }
  }, [open, deposito, zonas]);

  // Sincroniza litros con existencias_actuales (no usar valor guardado en depositos)
  useEffect(() => {
    if (!open) return;
    if (existencia) setLitros(existencia.litros);
    else if (!depositoId) setLitros(0);
  }, [open, depositoId, existencia]);

  const fmtNum = (n: number, d = 0) => n.toLocaleString("es-ES", { maximumFractionDigits: d });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{deposito ? `Editar ${deposito.codigo}` : "Nuevo depósito"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={input} />
            </Field>
            <Field label="Zona">
              <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} className={input}>
                {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacidad (L)">
              <input
                type="text"
                inputMode="numeric"
                value={capFocus ? capText : fmt(capText)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setCapText(digits);
                  setCapacidad(Number(digits) || 0);
                }}
                onFocus={() => setCapFocus(true)}
                onBlur={() => setCapFocus(false)}
                className={input}
              />
            </Field>
            <Field label="Litros actuales">
              <input
                type="text"
                value={existenciasQ.isLoading ? "…" : fmtNum(existencia?.litros ?? 0)}
                readOnly
                disabled
                title="Calculado desde existencias_actuales. Para modificar, registra un movimiento."
                className={input + " opacity-60 cursor-not-allowed"}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Calculado desde existencias_actuales (igual que el mapa).
              </p>
            </Field>
          </div>

          {depositoId && (
            <div className="rounded-lg border border-border p-3 space-y-2 bg-secondary/20">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Existencias actuales</div>
              {existenciasQ.isLoading ? (
                <div className="text-xs text-muted-foreground">Cargando…</div>
              ) : !existencia || existencia.lineas.length === 0 ? (
                <div className="text-xs text-muted-foreground">Sin existencias registradas</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-background/60 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Litros</div>
                      <div className="font-semibold tabular-nums">{fmtNum(existencia.litros)}</div>
                    </div>
                    <div className="rounded bg-background/60 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grado medio</div>
                      <div className="font-semibold tabular-nums">{existencia.grado_medio.toFixed(2)}</div>
                    </div>
                    <div className="rounded bg-background/60 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Alc. absoluto</div>
                      <div className="font-semibold tabular-nums">{fmtNum(existencia.alcohol_absoluto, 1)}</div>
                    </div>
                  </div>
                  {existencia.lineas.length === 1 ? (
                    <div className="text-xs text-muted-foreground">
                      Producto: <span className="text-foreground font-medium">{existencia.lineas[0].nombre}</span>
                    </div>
                  ) : (
                    <div className="rounded border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr><th className="text-left p-1.5">Producto</th><th className="text-right p-1.5">L</th><th className="text-right p-1.5">°</th><th className="text-right p-1.5">AA</th></tr>
                        </thead>
                        <tbody>
                          {existencia.lineas.map((l, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-1.5">{l.nombre}</td>
                              <td className="p-1.5 text-right tabular-nums">{fmtNum(l.litros)}</td>
                              <td className="p-1.5 text-right tabular-nums">{l.grado.toFixed(2)}</td>
                              <td className="p-1.5 text-right tabular-nums">{fmtNum(l.aa, 1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Field label="Estado">
            <div className="grid grid-cols-4 gap-1.5">
              {estados.map((s) => {
                const active = estado === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setEstado(s.key)}
                    className={`p-2 rounded-lg border text-[10px] font-medium flex flex-col items-center gap-1 transition-all ${
                      active ? "border-foreground" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </button>
                );
              })}

            </div>
          </Field>

          <Field label="Contenido / variedad">
            <input value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="ej. Airén 2024" className={input} />
          </Field>

          <Field label={`Tamaño visual (${radio}px)`}>
            <input type="range" min={16} max={40} value={radio} onChange={(e) => setRadio(+e.target.value)} className="w-full accent-accent" />
          </Field>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {deposito && onDelete && (
              <button
                onClick={() => { onDelete(); onOpenChange(false); }}
                className="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg"
              >
                Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              disabled={!codigo.trim() || !zonaId}
              onClick={() => {
                onSave({
                  codigo: codigo.trim(), zona_id: zonaId, capacidad,
                  litros: Math.min(litros, capacidad), estado,
                  contenido: contenido.trim() || undefined, radio,
                });
                onOpenChange(false);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const input = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
