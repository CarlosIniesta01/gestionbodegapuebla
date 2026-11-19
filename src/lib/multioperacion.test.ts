import { describe, expect, it } from "vitest";
import { compatibles, validarMultioperacion, validarUsoLote, cantidadEnUnidadLote } from "./multioperacion";
import type { ContextoPlanificacion } from "./plantillas-trabajo";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const operaciones = [1, 2, 3].map((n) => ({ id: id(n), codigo: `F08-0${n}`, tipo_formulario: "producto" }));
const plan = { plantilla_id: "clarificacion", plantilla_version: 1, naturaleza: "prevision", litros_previstos: 40000, parametros: {}, productos: [] };
const input = { version: 1, operaciones: operaciones.map((o) => ({ operacion_id: o.id, planificacion: plan })), productos: [1, 2, 3].map((n) => ({ id: id(n + 10), operacion_id: id(n), producto_id: id(n + 20), cantidad_prevista: n * 10, unidad: "kg" })) };
const contexto: ContextoPlanificacion = { depositos: [], productos: [1, 2, 3].map((n) => ({ id: id(n + 20), nombre: `P${n}`, tipo: "enologico", unidad: "kg" })), lotes: [], analiticas: [] };
describe("B2 orden única multioperación", () => {
  it("recupera tres operaciones y tres productos sin exigir lote ni caducidad al planificar", () => {
    const { multi, planes } = validarMultioperacion(JSON.parse(JSON.stringify(input)), operaciones[0], operaciones, contexto);
    expect(multi.productos).toHaveLength(3); expect(planes).toHaveLength(3); expect(multi.productos[2].cantidad_prevista).toBe(30);
  });
  it("rechaza cantidades previstas negativas", () => expect(() => validarMultioperacion({ ...input, productos: [{ ...input.productos[0], cantidad_prevista: -1 }] }, operaciones[0], operaciones, contexto)).toThrow());
  it("rechaza producto ajeno al centro", () => expect(() => validarMultioperacion(input, operaciones[0], operaciones, { ...contexto, productos: [] })).toThrow("centro"));
  it("impide operaciones repetidas", () => expect(() => validarMultioperacion({ ...input, operaciones: [input.operaciones[0], input.operaciones[0]] }, operaciones[0], operaciones, contexto)).toThrow("repitas"));
  it("impide productos enlazados a otra orden", () => expect(() => validarMultioperacion({ ...input, productos: [{ ...input.productos[0], operacion_id: id(100) }] }, operaciones[0], operaciones, contexto)).toThrow("vinculado"));
  it.each(["carga", "descarga", "embotellado", "traslado_intercentros"])("no absorbe formulario especializado %s", (tipo) => expect(compatibles(operaciones[0], { codigo: "F08-01", tipo_formulario: tipo })).toBe(false));
  it("no combina topologías de trasiego y tratamiento", () => expect(compatibles(operaciones[0], { codigo: "F06-01", tipo_formulario: "trasiego" })).toBe(false));
});
describe("Cantidades reales sin alterar la previsión", () => {
  const lote = { unidad: "kg", estado: "disponible", cantidad_disponible: 20, fecha_caducidad: "2027-01-01" };
  it("admite varios lotes del mismo producto con cantidades independientes", () => {
    expect(validarUsoLote(12, "kg", lote, "2027-01-01", "2026-11-19")).toBe(12);
    expect(validarUsoLote(8, "kg", { ...lote, cantidad_disponible: 8 }, "2027-01-01", "2026-11-19")).toBe(8);
    expect(input.productos[0].cantidad_prevista).toBe(10);
  });
  it("convierte 2 kg exactamente a 2000 g", () => expect(cantidadEnUnidadLote(2, "kg", "g")).toBe(2000));
  it("convierte 2 L exactamente a 2000 mL", () => expect(cantidadEnUnidadLote(2, "L", "mL")).toBe(2000));
  it("rechaza disponibilidad insuficiente", () => expect(() => validarUsoLote(21, "kg", lote, "2027-01-01", "2026-11-19")).toThrow("disponibilidad"));
  it("rechaza lote bloqueado", () => expect(() => validarUsoLote(1, "kg", { ...lote, estado: "bloqueado" }, "2027-01-01", "2026-11-19")).toThrow("bloqueado"));
  it("rechaza caducidad vencida", () => expect(() => validarUsoLote(1, "kg", { ...lote, fecha_caducidad: "2026-01-01" }, "2026-01-01", "2026-11-19")).toThrow("caducidad"));
  it("no permite cambiar una caducidad registrada", () => expect(() => validarUsoLote(1, "kg", lote, "2027-02-01", "2026-11-19")).toThrow("caducidad"));
  it("exige verificar fecha cuando el almacén no la tiene", () => expect(() => validarUsoLote(1, "kg", { ...lote, fecha_caducidad: null }, "", "2026-11-19")).toThrow("caducidad"));
  it("no convierte masa a volumen sin una equivalencia", () => expect(() => cantidadEnUnidadLote(1, "kg", "L")).toThrow("compatible"));
});