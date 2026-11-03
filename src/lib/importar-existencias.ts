// Lógica pura de interpretación del Excel de existencias (testeable).
export const normTxt = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[\s\-_.\/]+/g, "");

// Interpreta números en formato español o inglés: 205.000 → 205000, 13,50 → 13.5
export const parseNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[^\d,.\-]/g, "");
  if (!s || s === "-") return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = /^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const VACIOS = new Set(["", "0", "VACIO", "NINGUNO", "NA", "N/A"]);
export const esProductoVacio = (p: any) => VACIOS.has(normTxt(p)) || /^[\s\-–—]*$/.test(String(p ?? ""));

export type Columnas = Record<"dep" | "prod" | "lit" | "gr" | "centro" | "campana" | "tipo" | "color" | "estado" | "lote" | "obs", number>;

export function detectarColumnas(head: any[]): { cols: Columnas; hasHeader: boolean } {
  const h = head.map(normTxt);
  const find = (keys: string[]) => h.findIndex((x) => keys.some((k) => x.includes(k)));
  const cols: Columnas = {
    dep: find(["DEPOSITO", "TANQUE", "DEP"]), prod: find(["PRODUCTO", "VINO", "ARTICULO"]),
    lit: find(["LITRO", "CANTIDAD", "EXISTENCIA", "VOLUMEN"]), gr: find(["GRADO", "VOL%"]),
    centro: find(["CENTRO", "BODEGA"]), campana: find(["CAMPANA", "COSECHA", "ANADA"]),
    tipo: find(["TIPO"]), color: find(["COLOR"]), estado: find(["ESTADO"]),
    lote: find(["LOTE"]), obs: find(["OBSERV"]),
  };
  const hasHeader = cols.dep >= 0 || cols.lit >= 0;
  if (!hasHeader) return { hasHeader, cols: { dep: 0, prod: 1, lit: 2, gr: 3, centro: -1, campana: -1, tipo: -1, color: -1, estado: -1, lote: -1, obs: -1 } };
  return { hasHeader, cols };
}

// Devuelve litros/producto ya interpretados. Producto null = depósito vacío.
export function interpretarFila(r: any[], c: Columnas) {
  const get = (i: number) => (i >= 0 ? r[i] : "");
  const prodRaw = get(c.prod);
  const vacio = esProductoVacio(prodRaw);
  let litros = parseNum(get(c.lit));
  if (litros === null && vacio) litros = 0;
  const producto = vacio || litros === 0 ? null : String(prodRaw).replace(/\s+/g, " ").trim();
  return {
    depositoTxt: String(get(c.dep) ?? "").trim(),
    producto, litros, grado: litros ? parseNum(get(c.gr)) : null,
    centro: String(get(c.centro) ?? "").trim(), campana: String(get(c.campana) ?? "").trim() || null,
    tipo: String(get(c.tipo) ?? "").trim() || null, color: String(get(c.color) ?? "").trim() || null,
  };
}
