import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, History, Upload, CheckCircle2 } from "lucide-react";
import { importarExistencias, listImportacionesExistencias } from "@/lib/api/movimientos.functions";
import { detectarColumnas, interpretarFila, normTxt } from "@/lib/importar-existencias";
import { useActiveBodega } from "@/hooks/use-active-bodega";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bodegaId: string;
  depositos: any[];
  productos: any[];
  existencias: any[];
  onAplicado?: (cambios: { deposito_id: string; contenido: string; litros: number }[]) => void;
}

type Accion = "SIN CAMBIOS" | "CREAR PRODUCTO" | "AJUSTAR ENTRADA" | "AJUSTAR SALIDA" | "CAMBIAR PRODUCTO" | "VACIAR DEPÓSITO" | "ERROR";
const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

export function ImportarExistenciasDialog({ open, onOpenChange, bodegaId, depositos, productos, existencias, onAplicado }: Props) {
  const [matriz, setMatriz] = useState<any[][]>([]);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<any | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const { bodega } = useActiveBodega();
  const qc = useQueryClient();
  const importar = useServerFn(importarExistencias);
  const listHist = useServerFn(listImportacionesExistencias);
  const histQ = useQuery({ queryKey: ["importaciones-existencias", bodegaId], queryFn: () => listHist({ data: { bodegaId } }), enabled: open && verHistorial });

  const reset = () => { setMatriz([]); setTexto(""); setArchivo(null); setManual({}); };
  const cargarTexto = (t: string) => {
    setTexto(t); setArchivo(null); setManual({});
    setMatriz(t.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(l.includes("\t") ? "\t" : ";")));
  };
  const cargarArchivo = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
    setMatriz(rows.filter((r) => r.some((c) => String(c).trim())));
    setTexto(""); setArchivo(f.name); setManual({});
  };

  const filas = useMemo(() => {
    if (!matriz.length) return [];
    const { cols, hasHeader } = detectarColumnas(matriz[0]);
    const body = hasHeader ? matriz.slice(1) : matriz;
    const depByCod = new Map(depositos.map((d) => [normTxt(d.codigo), d]));
    const depById = new Map(depositos.map((d) => [d.id, d]));
    const prodByKey = new Map<string, any>();
    productos.forEach((p) => { prodByKey.set(normTxt(p.nombre), p); });
    const prodById = new Map(productos.map((p) => [p.id, p]));
    const vistos = new Set<string>();
    return body.map((r, i) => {
      const f = interpretarFila(r, cols);
      const errores: string[] = [];
      const deposito = (manual[i] ? depById.get(manual[i]) : depByCod.get(normTxt(f.depositoTxt))) ?? null;
      if (!deposito) errores.push("Depósito no encontrado");
      if (f.centro && bodega && normTxt(f.centro) !== normTxt(bodega.nombre)) errores.push(`Pertenece a otro centro (${f.centro}); cambia el centro activo`);
      if (f.litros === null || f.litros < 0) errores.push("Litros no válidos");
      if (deposito && f.litros && deposito.capacidad && f.litros > Number(deposito.capacidad))
        errores.push(`Capacidad superada. Depósito ${deposito.codigo} · Capacidad: ${fmt(Number(deposito.capacidad))} L · Importación: ${fmt(f.litros)} L`);
      if (deposito && vistos.has(deposito.id) && !errores.length) errores.push("Depósito repetido en el Excel");
      if (deposito && !errores.length) vistos.add(deposito.id);
      const producto = f.producto ? prodByKey.get(normTxt(f.producto)) ?? null : null;
      const nuevo = !!f.producto && !producto;
      const act = deposito ? existencias.filter((e) => e.deposito_id === deposito.id && Math.abs(Number(e.litros)) > 0.0001) : [];
      const actual = act.reduce((s, e) => s + Number(e.litros), 0);
      const actualProd = act.map((e) => prodById.get(e.producto_id)?.nombre ?? "(sin producto)").join(" + ") || "—";
      const actualGrado = act.length === 1 ? Number(act[0].grado_medio) || null : null;
      let accion: Accion;
      const litros = f.litros ?? 0;
      if (errores.length) accion = "ERROR";
      else if (litros === 0) accion = actual > 0.009 ? "VACIAR DEPÓSITO" : "SIN CAMBIOS";
      else if (nuevo) accion = "CREAR PRODUCTO";
      else if (act.length !== 1 || act[0].producto_id !== producto?.id) accion = act.length ? "CAMBIAR PRODUCTO" : "AJUSTAR ENTRADA";
      else if (Math.abs(litros - actual) < 0.01 && (f.grado == null || Math.abs((actualGrado ?? 0) - f.grado) < 0.005)) accion = "SIN CAMBIOS";
      else accion = litros >= actual ? "AJUSTAR ENTRADA" : "AJUSTAR SALIDA";
      return { i, f, deposito, producto, nuevo, errores, actual, actualProd, accion, litros };
    });
  }, [matriz, depositos, productos, existencias, manual, bodega]);

  const validas = filas.filter((f) => f.accion !== "ERROR");
  const aplicar = validas.filter((f) => f.accion !== "SIN CAMBIOS");
  const resumen = useMemo(() => {
    const nuevos = new Set(filas.filter((f) => f.nuevo && f.accion !== "ERROR").map((f) => normTxt(f.f.producto)));
    let le = 0, ls = 0;
    filas.forEach((f) => {
      if (f.accion === "ERROR" || f.accion === "SIN CAMBIOS") return;
      if (f.accion === "CAMBIAR PRODUCTO" || f.accion === "CREAR PRODUCTO") { ls += Math.max(f.actual, 0); le += f.litros; }
      else if (f.litros > f.actual) le += f.litros - f.actual; else ls += f.actual - f.litros;
    });
    return {
      nuevos: nuevos.size, actualizar: aplicar.length, vacios: filas.filter((f) => f.accion === "VACIAR DEPÓSITO").length,
      sinCambios: filas.filter((f) => f.accion === "SIN CAMBIOS").length, errores: filas.length - validas.length, le, ls,
    };
  }, [filas, aplicar.length, validas.length]);

  const mut = useMutation({
    mutationFn: () => importar({ data: {
      bodegaId, archivo, filasTotal: filas.length, filasRechazadas: filas.length - validas.length,
      lineas: aplicar.map((f) => ({
        deposito_id: f.deposito.id, deposito_codigo: f.deposito.codigo,
        producto_id: f.producto?.id ?? null,
        producto_nuevo: f.nuevo ? { nombre: f.f.producto!, campana: f.f.campana, tipo: f.f.tipo, color: f.f.color } : null,
        litros: f.litros, grado: f.f.grado,
      })),
    } }),
    onSuccess: (r) => {
      onAplicado?.(aplicar.map((f) => ({ deposito_id: f.deposito.id, contenido: f.litros > 0 ? (f.producto?.nombre ?? f.f.producto ?? "") : "", litros: f.litros })));
      qc.invalidateQueries();
      setResultado(r); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const color = (a: Accion) => a === "ERROR" ? "text-destructive" : a === "SIN CAMBIOS" ? "text-muted-foreground" : "text-primary";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setResultado(null); setVerHistorial(false); } }}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5" />Importación diaria de existencias</DialogTitle>
          <DialogDescription>
            Pega desde Excel o sube un archivo con <b>Depósito · Producto · Litros · Grado</b> (opcional: Centro, Campaña, Tipo, Color, Lote, Observaciones).
            El Excel es la foto real: cada depósito quedará exactamente así mediante ajustes. Los productos que no existan se crean solos.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-primary" />Importación completada</div>
              <ul className="mt-2 text-sm grid grid-cols-2 md:grid-cols-3 gap-1">
                <li>{resultado.productosCreados.length} productos creados</li>
                <li>{resultado.depositos} depósitos actualizados</li>
                <li>{resultado.vaciados} depósitos vaciados</li>
                <li>{resultado.movimientos} movimientos generados</li>
                <li>{resultado.sinCambios} sin cambios</li>
                <li>{resultado.filasIgnoradas} filas ignoradas</li>
              </ul>
            </div>
            {resultado.productosCreados.length > 0 && (
              <div className="rounded-xl border border-border p-3 text-sm">
                <p className="font-medium">Se han creado {resultado.productosCreados.length} productos nuevos.</p>
                <p className="text-muted-foreground text-xs mb-2">{resultado.productosCreados.map((p: any) => `${p.codigo} · ${p.nombre}`).join(" | ")}</p>
                <Button asChild size="sm" variant="outline"><Link to="/admin">Revisar productos nuevos</Link></Button>
                <span className="text-xs text-muted-foreground ml-2">(Administración → Productos comerciales)</span>
              </div>
            )}
            <DialogFooter><Button onClick={() => setResultado(null)}>Nueva importación</Button></DialogFooter>
          </div>
        ) : verHistorial ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border overflow-x-auto max-h-[60vh]">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 uppercase text-muted-foreground sticky top-0">
                  <tr>{["Fecha", "Usuario", "Archivo", "Filas", "Prod. creados", "Depósitos mod.", "Vaciados", "Rechazadas", "Movimientos"].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(histQ.data ?? []).map((h: any) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="p-2">{new Date(h.created_at).toLocaleString("es-ES")}</td><td className="p-2">{h.usuario}</td>
                      <td className="p-2">{h.archivo ?? "Pegado"}</td><td className="p-2">{h.filas_total}</td><td className="p-2">{h.productos_creados}</td>
                      <td className="p-2">{h.depositos_modificados}</td><td className="p-2">{h.depositos_vaciados}</td><td className="p-2">{h.filas_rechazadas}</td><td className="p-2">{h.movimientos_generados}</td>
                    </tr>
                  ))}
                  {!histQ.isLoading && !(histQ.data ?? []).length && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Sin importaciones todavía</td></tr>}
                </tbody>
              </table>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setVerHistorial(false)}>Volver</Button></DialogFooter>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-accent">
                <Upload className="size-4" />Subir archivo .xlsx / .csv
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && cargarArchivo(e.target.files[0])} />
              </label>
              <span className="text-xs text-muted-foreground">o pega abajo{archivo ? ` · ${archivo}` : ""}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setVerHistorial(true)}><History className="size-4 mr-1" />Ver historial de importaciones</Button>
            </div>
            <Textarea rows={4} value={texto} onChange={(e) => cargarTexto(e.target.value)}
              placeholder={"Depósito\tProducto\tLitros\tGrado\nD-16\tVINO ROSADO FC 2025\t205.000\t12,5\nD-12\t0\t-\t-"} className="font-mono text-xs" />

            {filas.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
                  {[["Productos nuevos", resumen.nuevos], ["Depósitos a actualizar", resumen.actualizar], ["Quedan vacíos", resumen.vacios],
                    ["Sin cambios", resumen.sinCambios], ["Errores", resumen.errores], ["Litros entrada", fmt(resumen.le)], ["Litros salida", fmt(resumen.ls)]]
                    .map(([l, v]) => <div key={l as string} className="rounded-lg border border-border p-2"><div className="text-muted-foreground">{l}</div><div className="text-base font-semibold tabular-nums">{v}</div></div>)}
                </div>
                <div className="rounded-xl border border-border overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50 uppercase text-muted-foreground sticky top-0">
                      <tr><th className="p-2 text-left">Depósito</th><th className="p-2 text-left">Producto actual</th><th className="p-2 text-right">Litros actuales</th>
                        <th className="p-2 text-left">Producto Excel</th><th className="p-2 text-right">Litros Excel</th><th className="p-2 text-right">Grado</th>
                        <th className="p-2 text-left">Acción</th><th className="p-2 text-left">Estado</th></tr>
                    </thead>
                    <tbody>
                      {filas.map((f) => (
                        <tr key={f.i} className={`border-t border-border ${f.accion === "ERROR" ? "bg-destructive/5" : ""}`}>
                          <td className="p-2 font-mono">
                            {f.deposito && !manual[f.i] ? f.deposito.codigo : (
                              <select className="border border-border rounded px-1 py-0.5 bg-background" value={manual[f.i] ?? ""}
                                onChange={(e) => setManual((m) => ({ ...m, [f.i]: e.target.value }))}>
                                <option value="">{f.f.depositoTxt || "?"} → elegir…</option>
                                {depositos.map((d) => <option key={d.id} value={d.id}>{d.codigo}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="p-2">{f.actualProd}</td>
                          <td className="p-2 text-right tabular-nums">{fmt(f.actual)}</td>
                          <td className="p-2">{f.f.producto ?? "(vacío)"}{f.nuevo && <span className="ml-1 text-[10px] rounded bg-primary/10 text-primary px-1">nuevo</span>}</td>
                          <td className="p-2 text-right tabular-nums font-medium">{fmt(f.f.litros)}</td>
                          <td className="p-2 text-right tabular-nums">{f.f.grado?.toFixed(2) ?? "—"}</td>
                          <td className={`p-2 font-medium ${color(f.accion)}`}>{f.accion}</td>
                          <td className="p-2">{f.errores.length ? <span className="text-destructive">{f.errores.join("; ")}</span> : <span className="text-primary">OK</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <DialogFooter className="items-center">
              {filas.length > 0 && <span className="text-xs text-muted-foreground mr-auto">Las filas con error no se aplicarán.</span>}
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={!aplicar.length || mut.isPending} onClick={() => mut.mutate()}>
                {mut.isPending ? "Aplicando…" : filas.length && !aplicar.length ? "Todo coincide" : `Aplicar importación (${aplicar.length})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
