import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizarCorreo, rolDelCentro, conservarAccesoExistente } from "@/lib/invitaciones-trabajadores";

// Email always returns to the published public activation screen, not an editor iframe.
const activationUrl = "https://gestionbodegapuebla.lovable.app/activar-acceso";

export async function crearInvitacion(client: SupabaseClient<Database>, admin: SupabaseClient<Database>, input: { bodegaId: string; roleId: string; email: string }) {
  const email = normalizarCorreo(input.email);
  const { data: role, error: roleError } = await client.from("roles").select("bodega_id, activo").eq("id", input.roleId).maybeSingle();
  if (roleError) throw new Error(roleError.message);
  if (!rolDelCentro(role, input.bodegaId)) throw new Error("El rol no está disponible en este centro.");

  let target: { id: string } | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    target = data.users.find((u) => normalizarCorreo(u.email ?? "") === email);
    if (target || data.users.length < 1000) break;
  }
  if (target) {
    const { data: membership, error } = await client.from("memberships").select("estado").eq("user_id", target.id).eq("bodega_id", input.bodegaId).maybeSingle();
    if (error) throw new Error(error.message);
    if (conservarAccesoExistente(membership)) return { ok: true, message: "El trabajador ya tiene acceso a este centro; no se ha cambiado su rol." };
  }
  const { data: previous, error: previousError } = await client.from("invitaciones_trabajadores").select("id, sent_at, estado, role_id").eq("bodega_id", input.bodegaId).eq("email", email).maybeSingle();
  if (previousError) throw new Error(previousError.message);
  if (previous && previous.role_id !== input.roleId) throw new Error("Ya existe una invitación con otro rol; no se ha cambiado la invitación pendiente.");
  if (previous?.estado === "activada") throw new Error("Esta invitación ya se activó; revisa el acceso existente en Usuarios.");
  if (previous?.sent_at && Date.now() - Date.parse(previous.sent_at) < 60_000) throw new Error("La invitación acaba de enviarse. Espera un minuto antes de reenviarla.");

  const { data: invitationId, error: registerError } = await client.rpc("registrar_invitacion_trabajador", { _bodega: input.bodegaId, _rol: input.roleId, _email: email, _user: target?.id });
  if (registerError) throw new Error(registerError.message);

  let sendError: string | null = null;
  if (!target) {
    const result = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: activationUrl });
    sendError = result.error?.message ?? null;
    if (result.data.user) target = { id: result.data.user.id };
  } else {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("El envío de invitaciones no está configurado.");
    const publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await publicClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: activationUrl } });
    sendError = result.error?.message ?? null;
  }
  const { error: saveError } = await admin.from("invitaciones_trabajadores").update({
    user_id: target?.id ?? null, send_error: sendError, ...(sendError ? {} : { sent_at: new Date().toISOString() }),
  }).eq("id", invitationId);
  if (saveError) throw new Error("No se pudo registrar el resultado del envío. Revisa las invitaciones antes de repetir.");
  if (sendError) throw new Error(`Invitación pendiente, pero el correo no se pudo enviar: ${sendError}`);
  return { ok: true, message: target ? "Invitación enviada. El acceso quedará pendiente hasta que el trabajador se autentique." : "Invitación enviada." };
}