import { describe, expect, it } from "vitest";
import { plantillaParaOperacion, validarPlanificacion, validarRelacionesPlan, type ContextoPlanificacion } from "./plantillas-trabajo";
const plan = { plantilla_id: "trasiego", plantilla_version: 1, naturaleza: "prevision", litros_previstos: 40000, parametros: {}, productos: [] };
const contexto: ContextoPlanificacion = { depositos: [
  { id: "a", codigo: "D1", capacidad: 60000, litros: 40000, contenidos: [] },
  { id: "b", codigo: "D2", capacidad: 50000, litros: 10000, contenidos: [] },
], productos: [], lotes: [], analiticas: [] };
describe("Plantillas B2 primera entrega", () => {
  it("F06-08 permanece bloqueada incluso si se clasifica como trasiego", () => expect(plantillaParaOperacion({ codigo: "F06-08", tipo_formulario: "trasiego" })).toBeNull());
  it.each(["carga", "descarga", "embotellado"])("no sustituye %s", (tipo) => expect(plantillaParaOperacion({ codigo: "F08-01", tipo_formulario: tipo })).toBeNull());
  it("no simula repartos como trasiegos", () => expect(plantillaParaOperacion({ codigo: "F06-04", tipo_formulario: "trasiego" })).toBeNull());
  it("elige fermentación", () => expect(plantillaParaOperacion({ codigo: "F05-01", tipo_formulario: "operacion" })).toBe("fermentacion"));
  it("elige clarificación", () => expect(plantillaParaOperacion({ codigo: "F08-01", tipo_formulario: "producto" })).toBe("clarificacion"));
  it("recupera parámetros estructurados sin cambios tras serializar", () => expect(validarPlanificacion(JSON.parse(JSON.stringify(plan)), "trasiego")).toEqual(plan));
  it("rechaza otra plantilla", () => expect(() => validarPlanificacion(plan, "fermentacion")).toThrow());
  it("rechaza unidades ajenas", () => expect(() => validarPlanificacion({ ...plan, parametros: { temperatura: { valor: "20", unidad: "°C" } } }, "trasiego")).toThrow());
  it("valida volumen y capacidad exactos", () => expect(() => validarRelacionesPlan(validarPlanificacion(plan, "trasiego"), contexto, "D1", "D2")).not.toThrow());
  it("rechaza depósitos fuera del centro", () => expect(() => validarRelacionesPlan(validarPlanificacion(plan, "trasiego"), contexto, "OTRO", "D2")).toThrow());
  it("rechaza origen igual a destino", () => expect(() => validarRelacionesPlan(validarPlanificacion(plan, "trasiego"), contexto, "D1", "D1")).toThrow());
  it("rechaza litros superiores a existencias", () => expect(() => validarRelacionesPlan(validarPlanificacion({ ...plan, litros_previstos: 40001 }, "trasiego"), contexto, "D1", "D2")).toThrow());
  it("rechaza capacidad insuficiente", () => expect(() => validarRelacionesPlan(validarPlanificacion(plan, "trasiego"), { ...contexto, depositos: [contexto.depositos[0], { ...contexto.depositos[1], capacidad: 49999 }] }, "D1", "D2")).toThrow());
  it("rechaza producto y lote de otro centro", () => {
    const p = validarPlanificacion({ ...plan, plantilla_id: "clarificacion", productos: [{ producto_id: "00000000-0000-4000-8000-000000000001", lote_id: "00000000-0000-4000-8000-000000000002", dosis: 50, unidad_dosis: "g/hL", unidad_cantidad: "kg" }] }, "clarificacion");
    expect(() => validarRelacionesPlan(p, contexto, undefined, "D1")).toThrow("centro");
  });
});