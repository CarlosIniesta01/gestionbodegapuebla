import { describe, it, expect } from "vitest";
import { categoriaDistribucion, planAsignacion, requiereNuevoResponsable, filtrarMisTrabajos, type Asig } from "./asignaciones";

const a = (id: string, uid: string, estado = "asignado", activa = true, resp = false): Asig =>
  ({ id, trabajador_id: uid, estado_participacion: estado, activa, es_responsable: resp });

describe("distribución", () => {
  it("sin asignaciones activas = sin asignar", () => expect(categoriaDistribucion([a("1", "u", "retirado", false)])).toBe("sin_asignar"));
  it("varios operarios sin responsable = incompleta", () => expect(categoriaDistribucion([a("1", "u"), a("2", "v")])).toBe("incompleta"));
  it("un rechazo activo = con rechazo", () => expect(categoriaDistribucion([a("1", "u", "rechazado")])).toBe("con_rechazo"));
  it("todos aceptados con responsable = asignado", () => expect(categoriaDistribucion([a("1", "u", "aceptado", true, true), a("2", "v", "aceptado")])).toBe("asignado"));
});

describe("asignar sin duplicados", () => {
  it("no duplica un operario ya activo", () => expect(planAsignacion([a("1", "u")], ["u", "u"]).omitidos).toEqual(["u"]));
  it("reasigna un rechazado reactivando su fila", () => expect(planAsignacion([a("1", "u", "rechazado")], ["u"]).reactivar).toEqual(["1"]));
  it("reactiva un retirado en vez de insertar", () => expect(planAsignacion([a("1", "u", "retirado", false)], ["u"])).toEqual({ insertar: [], reactivar: ["1"], omitidos: [] }));
  it("inserta varios operarios nuevos", () => expect(planAsignacion([], ["u", "v"]).insertar).toEqual(["u", "v"]));
});

describe("responsable", () => {
  it("retirar al responsable con 2+ restantes exige otro", () =>
    expect(requiereNuevoResponsable([a("1", "u", "asignado", true, true), a("2", "v"), a("3", "w")], "1")).toBe(true));
  it("retirar a un colaborador no exige", () =>
    expect(requiereNuevoResponsable([a("1", "u", "asignado", true, true), a("2", "v"), a("3", "w")], "2")).toBe(false));
});

describe("mis trabajos", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const it_ = (estado: string, fecha: string | null, tEstado = "pendiente", activa = true) =>
    ({ estado_participacion: estado, activa, trabajo: { scheduled_at: fecha, estado: tEstado } });
  const items = [it_("asignado", "2026-11-18T08:00:00Z"), it_("aceptado", "2026-11-20T08:00:00Z"), it_("asignado", "2026-11-18T09:00:00Z", "cancelado"), it_("rechazado", null)];
  it("hoy excluye cancelados", () => expect(filtrarMisTrabajos(items, "hoy", now)).toHaveLength(1));
  it("pendientes de respuesta solo asignados vivos", () => expect(filtrarMisTrabajos(items, "pendientes", now)).toHaveLength(1));
  it("historial incluye rechazados y cancelados", () => expect(filtrarMisTrabajos(items, "historial", now)).toHaveLength(2));
});
