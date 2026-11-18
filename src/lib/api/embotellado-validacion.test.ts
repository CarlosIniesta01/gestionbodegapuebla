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
