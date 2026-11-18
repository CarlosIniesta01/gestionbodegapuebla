import { describe, it, expect } from "vitest";
import { validarCentro } from "./embotellado-validacion";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
// Cliente simulado: sin escrituras, nada toca la base de datos real.
function mock() {
  const maps: Record<string, string[]> = { [A]: ["D-01", "D-02"], [B]: ["D-1"] };
  const prods = [{ id: "p-a", bodega_id: A }, { id: "p-b", bodega_id: B }];
  return {
    rpc: async () => ({ data: [A], error: null }),
    from: (t: string) => ({
      select: () => ({
        eq: (_c: string, v: string) => ({ maybeSingle: async () => ({ data: { data: { depositos: (maps[v] ?? []).map((codigo) => ({ codigo })) } } }) }),
        in: async (_c: string, ids: string[]) => ({ data: t === "productos" ? prods.filter((p) => ids.includes(p.id)) : [], error: null }),
      }),
    }),
  };
}

describe("embotellado: validación de centro", () => {
  it("acepta depósito y producto del centro elegido", async () => {
    await expect(validarCentro(mock(), A, ["D-01"], ["p-a"])).resolves.toBeUndefined();
  });
  it("rechaza un centro sin acceso", async () => {
    await expect(validarCentro(mock(), B, ["D-1"])).rejects.toThrow("No tienes acceso");
  });
  it("rechaza depósito de otro centro", async () => {
    await expect(validarCentro(mock(), A, ["D-1"])).rejects.toThrow("no pertenece al centro");
  });
  it("rechaza producto de otro centro", async () => {
    await expect(validarCentro(mock(), A, ["D-01"], ["p-b"])).rejects.toThrow("productos que no pertenecen");
  });
});

import { validarOperacionCentro } from "./embotellado-validacion";
function mockOp(op: any, fam: any, cfg: any) {
  const res: Record<string, any> = { operaciones_catalogo: op, familias_operativas: fam, centro_operaciones: cfg };
  const chain = (t: string): any => ({ select: () => chain(t), eq: () => chain(t), maybeSingle: async () => ({ data: res[t], error: null }) });
  return { from: chain };
}
describe("trabajos: operación habilitada en el centro", () => {
  const op = { id: "o", activo: true, bodega_id: null, familia_id: "f" };
  it("acepta operación global activa sin configuración (habilitada por defecto)", async () => {
    await expect(validarOperacionCentro(mockOp(op, { activo: true }, null), A, "o")).resolves.toBeUndefined();
  });
  it("rechaza operación deshabilitada en el centro", async () => {
    await expect(validarOperacionCentro(mockOp(op, { activo: true }, { habilitada: false }), A, "o")).rejects.toThrow("deshabilitada");
  });
  it("rechaza operación propia de otro centro", async () => {
    await expect(validarOperacionCentro(mockOp({ ...op, bodega_id: B }, { activo: true }, null), A, "o")).rejects.toThrow("no está disponible");
  });
});

describe("traslado entre centros", () => {
  it("rechaza guardar F06-08 (traslado intercentros) como trasiego ordinario", async () => {
    const op = { id: "o", activo: true, bodega_id: null, familia_id: "f", tipo_formulario: "traslado_intercentros" };
    await expect(validarOperacionCentro(mockOp(op, { activo: true }, null), A, "o")).rejects.toThrow("pendiente de configuración");
  });
  it("no bloquea un trasiego normal dentro del centro", async () => {
    const op = { id: "o", activo: true, bodega_id: null, familia_id: "f", tipo_formulario: "trasiego" };
    await expect(validarOperacionCentro(mockOp(op, { activo: true }, null), A, "o")).resolves.toBeUndefined();
  });
});
