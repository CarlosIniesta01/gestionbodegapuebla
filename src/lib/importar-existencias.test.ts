import { describe, it, expect } from "vitest";
import { parseNum, interpretarFila, detectarColumnas, normTxt } from "./importar-existencias";

const { cols } = detectarColumnas(["Depósito", "Producto", "Litros", "Grado"]);

describe("importar existencias", () => {
  it("205.000 son 205000 litros", () => expect(parseNum("205.000")).toBe(205000));
  it("13,50 son 13.5 grados", () => expect(parseNum("13,50")).toBe(13.5));
  it("11.15 se mantiene decimal", () => expect(parseNum("11.15")).toBe(11.15));
  it("D-12 | 0 | - | - es depósito vacío", () => {
    const f = interpretarFila(["D-12", "0", "-", "-"], cols);
    expect(f.producto).toBeNull();
    expect(f.litros).toBe(0);
  });
  it("VACÍO con 0 litros es vacío", () => expect(interpretarFila(["D-1", "VACÍO", "0", ""], cols).producto).toBeNull());
  it("mayúsculas/tildes no duplican producto", () =>
    expect(normTxt("VINO BLANCO FC 2025")).toBe(normTxt("Vino  Blanco-FC 2025")));
  it("sin grado no es error", () => expect(interpretarFila(["D-1", "Tinto", "100", ""], cols).grado).toBeNull());
});
