export function normalizarCorreo(email: string) {
  return email.trim().toLowerCase();
}

export function cuentaAutenticada(user: { email_confirmed_at?: string; last_sign_in_at?: string }) {
  return Boolean(user.email_confirmed_at && user.last_sign_in_at);
}

export function rolDelCentro(role: { bodega_id: string | null; activo: boolean } | null, centro: string) {
  return Boolean(role?.activo && role.bodega_id === centro);
}

export function conservarAccesoExistente(existing: { estado: string } | null) {
  if (!existing) return false;
  if (existing.estado !== "activo") throw new Error("El trabajador ya tiene un acceso suspendido, inactivo o revocado; revísalo en Usuarios.");
  return true;
}