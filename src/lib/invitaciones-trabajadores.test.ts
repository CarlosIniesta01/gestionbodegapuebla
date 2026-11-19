import { describe, it, expect } from "vitest";
import { cuentaAutenticada, rolDelCentro, normalizarCorreo, conservarAccesoExistente } from "./invitaciones-trabajadores";

describe("Alta segura de trabajadores", () => {
  it("reutiliza el mismo correo sin distinguir mayúsculas ni espacios", () => {
    expect(normalizarCorreo(" Trabajador@Empresa.es ")).toBe("trabajador@empresa.es");
  });
  it("no considera activada una cuenta sin confirmar correo", () => {
    expect(cuentaAutenticada({ last_sign_in_at: "2026-11-19" })).toBe(false);
  });
  it("no considera activada una cuenta sin autenticación", () => {
    expect(cuentaAutenticada({ email_confirmed_at: "2026-11-19" })).toBe(false);
  });
  it("admite correo verificado y autenticación completada", () => {
    expect(cuentaAutenticada({ email_confirmed_at: "2026-11-19", last_sign_in_at: "2026-11-19" })).toBe(true);
  });
  it("rechaza roles de otro centro", () => {
    expect(rolDelCentro({ bodega_id: "centro-b", activo: true }, "centro-a")).toBe(false);
  });
  it("rechaza roles inactivos", () => {
    expect(rolDelCentro({ bodega_id: "centro-a", activo: false }, "centro-a")).toBe(false);
  });
  it("no duplica ni cambia un acceso existente", () => {
    expect(conservarAccesoExistente({ estado: "activo" })).toBe(true);
    expect(conservarAccesoExistente(null)).toBe(false);
  });
  it("no reactiva accesos revocados mediante invitaciones", () => {
    expect(() => conservarAccesoExistente({ estado: "rechazado" })).toThrow();
    expect(() => conservarAccesoExistente({ estado: "suspendido" })).toThrow();
  });
});