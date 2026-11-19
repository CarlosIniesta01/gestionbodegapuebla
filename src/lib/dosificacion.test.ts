import { describe, expect, it } from "vitest";
import { calcularDosificacion, decimalPositivo } from "./dosificacion";
describe("Dosificación prevista", () => {
  it("40.000 L con 50 g/hL son 20 kg", () => expect(calcularDosificacion(40000, 50, "g/hL", "kg")).toBe(20));
  it.each([
    ["kg/hL", "g", 400000], ["mL/hL", "mL", 400], ["L/hL", "L", 400],
    ["g/L", "kg", 40], ["mg/L", "g", 40],
  ] as const)("convierte %s a %s", (unidad, salida, total) => expect(calcularDosificacion(40000, 1, unidad, salida)).toBe(total));
  it("calcula sobre litros tratados, no capacidad", () => expect(calcularDosificacion(10000, 50, "g/hL", "kg")).toBe(5));
  it("rechaza masa a volumen sin densidad", () => expect(() => calcularDosificacion(40000, 50, "g/hL", "L")).toThrow("densidad"));
  it("convierte masa a volumen con densidad conocida", () => expect(calcularDosificacion(40000, 50, "g/hL", "L", 2)).toBe(10));
  it("convierte volumen a masa con densidad conocida", () => expect(calcularDosificacion(40000, 50, "mL/hL", "kg", 2)).toBe(40));
  it.each([0, -1, NaN, Infinity])("rechaza litros inválidos %s", (n) => expect(() => calcularDosificacion(n, 50, "g/hL", "kg")).toThrow());
  it("admite coma decimal", () => expect(decimalPositivo("0,25")).toBe(0.25));
  it("rechaza separadores ambiguos", () => expect(() => decimalPositivo("40.000,5")).toThrow());
});