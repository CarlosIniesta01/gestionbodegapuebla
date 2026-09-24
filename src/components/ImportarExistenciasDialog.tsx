import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import { importarExistencias } from "@/lib/api/movimientos.functions";
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
}

const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s\-_.]/g, "");
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

type Fila = { raw: string[]; deposito: any | null; producto: any | null; litros: number | null; grado: number | null; errores: string[]; actual: number };

export function ImportarExistenciasDialog({ open, onOpenChange, bodegaId, depositos, productos, existencias }: Props) {
  const [matriz, setMatriz] = useState<any[][]>([]);
  const [texto, setTexto] = useState("");
  const qc = useQueryClient();
  const importar = useServerFn(importarExistencias);

  const cargarTexto = (t: string) => {
    setTexto(t);
    setMatriz(t.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(l.includes("\t") ? "\t" : ";")));
  };
  const cargarArchivo = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    setMatriz(rows.filter((r) => r.some((c) => String(c).trim())));
    setTexto("");
  };

  const filas: Fila[] = useMemo(() => {
    if (!matriz.length) return [];
    const head = matriz[0].map(norm);
    const find = (keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
    let iDep = find(["DEPOSITO", "DEP", "TANQUE"]);
    let iProd = find(["PRODUCTO", "VINO", "CODIGO"]);
    let iLit = find(["LITRO", "CANTIDAD", "EXISTENCIA", "VOLUMEN"]);
    let iGr = find(["GRADO", "ALCOHOL", "VOL%"]);
    const hasHeader = iDep >= 0 || iLit >= 0;
    if (!hasHeader) { iDep = 0; iProd = 1; iLit = 2; iGr = 3; }
    const body = hasHeader ? matriz.slice(1) : matriz;
    const depByCod = new Map(depositos.map((d) => [norm(d.codigo), d]));
    const prodByKey = new Map<string, any>();
    productos.forEach((p) => { prodByKey.set(norm(p.nombre), p); if (p.codigo) prodByKey.set(norm(p.codigo), p); });
    return body.map((r) => {
      const errores: string[] = [];
      const depTxt = r[iDep] ?? "";
      const deposito = depByCod.get(norm(depTxt)) ?? null;
      if (!deposito) errores.push(`Depósito "${depTxt}" no existe`);
      const prodTxt = iProd >= 0 ? r[iProd] : "";
      const litros = num(r[iLit]);
      const producto = prodTxt ? prodByKey.get(norm(prodTxt)) ?? null : null;
      if (prodTxt && !producto) errores.push(`Producto "${prodTxt}" no existe`);
      if (litros === null || litros < 0) errores.push("Litros no válidos");
      if (litros && litros > 0 && !prodTxt) errores.push("Falta producto");
      const grado = iGr >= 0 ? num(r[iGr]) : null;
      if (litros && deposito?.capacidad && litros > Number(deposito.capacidad)) errores.push(`Supera capacidad (${deposito.capacidad} L)`);
      const actual = deposito ? existencias.filter((e) => e.deposito_id === deposito.id).reduce((s, e) => s + Number(e.litros), 0) : 0;
      return { raw: r.map(String), deposito, producto, litros, grado, errores, actual };
    });
  }, [matriz, depositos, productos, existencias]);

  const validas = filas.filter((f) => !f.errores.length);

  const mut = useMutation({
    mutationFn: () => importar({ data: { bodegaId, lineas: validas.map((f) => ({
      deposito_id: f.deposito.id, producto_id: f.producto?.id ?? null, litros: f.litros ?? 0, grado: f.grado,
    })) } }),
    onSuccess: (r) => {
      toast.success(`Existencias actualizadas: ${r.depositos} depósitos (${r.sinCambios} sin cambios).`);
      qc.invalidateQueries();
      setMatriz([]); setTexto(""); onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5" />Importar existencias desde Excel</DialogTitle>
          <DialogDescription>
            Copia desde Excel las columnas <b>Depósito · Producto · Litros · Grado</b> y pégalas aquí, o sube el archivo.
            Cada depósito listado quedará exactamente con esos datos mediante movimientos de ajuste (quedan en el historial).
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 items-center">
          <label className="inline-flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-accent">
            <Upload className="size-4" />Subir archivo .xlsx / .csv
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && cargarArchivo(e.target.files[0])} />
          </label>
          <span className="text-xs text-muted-foreground">o pega abajo</span>
        </div>
        <Textarea rows={5} value={texto} onChange={(e) => cargarTexto(e.target.value)}
          placeholder={"Depósito\tProducto\tLitros\tGrado\nD-38\tTINTO JOVEN 2025\t25000\t13,5"} className="font-mono text-xs" />

        {filas.length > 0 && (
          <div className="rounded-xl border border-border overflow-x-auto max-h-[40vh]">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 uppercase text-muted-foreground sticky top-0">
                <tr><th className="p-2 text-left">Depósito</th><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Nuevo</th><th className="p-2 text-right">Grado</th><th className="p-2 text-left">Estado</th></tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className={`border-t border-border ${f.errores.length ? "bg-destructive/5" : ""}`}>
                    <td className="p-2 font-mono">{f.deposito?.codigo ?? f.raw[0]}</td>
                    <td className="p-2">{f.producto?.nombre ?? (f.litros ? "—" : "(vacío)")}</td>
                    <td className="p-2 text-right tabular-nums">{f.actual.toLocaleString("es-ES", { maximumFractionDigits: 0 })}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{f.litros?.toLocaleString("es-ES", { maximumFractionDigits: 0 }) ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">{f.grado?.toFixed(2) ?? "—"}</td>
                    <td className="p-2">{f.errores.length ? <span className="text-destructive">{f.errores.join("; ")}</span> : <span className="text-primary">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="items-center">
          {filas.length > 0 && <span className="text-xs text-muted-foreground mr-auto">{validas.length} válidas · {filas.length - validas.length} con errores (se ignorarán)</span>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!validas.length || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Aplicando…" : `Aplicar ${validas.length} filas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
