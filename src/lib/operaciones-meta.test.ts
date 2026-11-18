import { describe, it, expect } from "vitest";
import { operacionesDisponibles, habilitadaEnCentro, type Familia, type Operacion } from "./operaciones-meta";

const fam = (id: string, p: Partial<Familia> = {}): Familia => ({ id, bodega_id: null, codigo: id, nombre: id, descripcion: null, icono: "", color: "#000000", orden: 0, activo: true, ...p });
const op = (id: string, familia_id: string, p: Partial<Operacion> = {}): Operacion => ({ id, familia_id, bodega_id: null, codigo: id, nombre: id, descripcion: null, activo: true, orden: 0, tipo_formulario: "operacion", requiere_deposito_origen: false, requiere_deposito_destino: false, requiere_producto: false, requiere_lote: false, requiere_operarios: true, requiere_laboratorio: false, admite_productos_enologicos: false, admite_consumos: false, admite_movimientos: false, admite_ejecucion_parcial: false, requiere_autorizacion: false, ...p });

describe("operaciones por centro", () => {
  it("sin configuración, la operación está habilitada", () => {
    expect(habilitadaEnCentro([], "A", "o1")).toBe(true);
  });
  it("deshabilitar en un centro no afecta a otro", () => {
    const cfg = [{ bodega_id: "A", operacion_id: "o1", habilitada: false }];
    const f = [fam("f")]; const o = [op("o1", "f")];
    expect(operacionesDisponibles(f, o, cfg, "A")).toHaveLength(0);
    expect(operacionesDisponibles(f, o, cfg, "B")).toHaveLength(1);
  });
  it("operaciones inactivas o de familia inactiva no se ofrecen", () => {
    const f = [fam("f1"), fam("f2", { activo: false })];
    const o = [op("a", "f1", { activo: false }), op("b", "f2"), op("c", "f1")];
    expect(operacionesDisponibles(f, o, [], "A").map((x) => x.id)).toEqual(["c"]);
  });
  it("operaciones propias de otro centro no se muestran", () => {
    const o = [op("x", "f", { bodega_id: "B" })];
    expect(operacionesDisponibles([fam("f")], o, [], "A")).toHaveLength(0);
  });
});
