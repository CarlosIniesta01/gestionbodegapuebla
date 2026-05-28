import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============ Helpers ============
async function assertAdmin(supabase: any, userId: string, bodegaId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role_id, roles!inner(key)")
    .eq("user_id", userId)
    .eq("bodega_id", bodegaId)
    .eq("estado", "activo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data as any).roles?.key !== "admin") {
    throw new Error("Forbidden: requires admin role");
  }
}

// ============ Bodega selector ============
export const listMyBodegas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("memberships")
      .select("bodega_id, roles!inner(key, nombre), bodegas!inner(id, nombre, ubicacion)")
      .eq("user_id", userId)
      .eq("estado", "activo");
    if (error) throw new Error(error.message);
    return (data ?? []).map((m: any) => ({
      bodega_id: m.bodega_id,
      role_key: m.roles.key,
      role_nombre: m.roles.nombre,
      bodega: m.bodegas,
    }));
  });

// ============ Users / Members ============
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const { data: rows, error } = await supabase
      .from("memberships")
      .select("id, user_id, estado, created_at, role_id, roles(id, key, nombre, color, icono)")
      .eq("bodega_id", data.bodegaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profilesById: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, nombre, email, avatar_url")
        .in("user_id", userIds);
      if (pErr) throw new Error(pErr.message);
      profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, profiles: profilesById[r.user_id] ?? null }));
  });

export const addMemberByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    email: z.string().email(),
    roleId: z.string().uuid(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);

    // Find user by email via admin
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const target = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
    if (!target) throw new Error("Usuario no encontrado. Pídele que cree una cuenta primero.");

    // Ensure profile exists
    await supabaseAdmin.from("profiles").upsert({
      user_id: target.id,
      email: target.email,
      nombre: target.user_metadata?.nombre ?? target.email?.split("@")[0],
    }, { onConflict: "user_id" });

    const { error } = await supabaseAdmin.from("memberships").insert({
      user_id: target.id,
      bodega_id: data.bodegaId,
      role_id: data.roleId,
      estado: "activo",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    membershipId: z.string().uuid(),
    bodegaId: z.string().uuid(),
    roleId: z.string().uuid().optional(),
    estado: z.enum(["activo", "suspendido", "inactivo"]).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const patch: any = {};
    if (data.roleId) patch.role_id = data.roleId;
    if (data.estado) patch.estado = data.estado;
    const { error } = await supabase.from("memberships").update(patch).eq("id", data.membershipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ membershipId: z.string().uuid(), bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const { error } = await supabase.from("memberships").delete().eq("id", data.membershipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Roles & Permissions ============
export const listRolesAndPerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const [rolesRes, permsRes, rpRes] = await Promise.all([
      supabase.from("roles").select("*").eq("bodega_id", data.bodegaId).order("is_system", { ascending: false }).order("nombre"),
      supabase.from("permissions").select("*").order("categoria").order("label"),
      supabase.from("role_permissions").select("role_id, permission_key, roles!inner(bodega_id)").eq("roles.bodega_id", data.bodegaId),
    ]);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (permsRes.error) throw new Error(permsRes.error.message);
    if (rpRes.error) throw new Error(rpRes.error.message);
    return {
      roles: rolesRes.data ?? [],
      permissions: permsRes.data ?? [],
      rolePerms: (rpRes.data ?? []).map((r: any) => ({ role_id: r.role_id, permission_key: r.permission_key })),
    };
  });

export const toggleRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    roleId: z.string().uuid(),
    permissionKey: z.string().min(1),
    enabled: z.boolean(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    if (data.enabled) {
      const { error } = await supabase.from("role_permissions").upsert(
        { role_id: data.roleId, permission_key: data.permissionKey },
        { onConflict: "role_id,permission_key" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", data.roleId)
        .eq("permission_key", data.permissionKey);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const upsertRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    id: z.string().uuid().optional(),
    key: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/),
    nombre: z.string().min(1).max(60),
    color: z.string().default("#6b7280"),
    icono: z.string().default("Shield"),
    descripcion: z.string().optional(),
    activo: z.boolean().default(true),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const payload: any = {
      bodega_id: data.bodegaId,
      key: data.key,
      nombre: data.nombre,
      color: data.color,
      icono: data.icono,
      descripcion: data.descripcion ?? null,
      activo: data.activo,
    };
    if (data.id) {
      const { error } = await supabase.from("roles").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase.from("roles").insert({ ...payload, is_system: false }).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid(), roleId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    // Block deletion of system roles
    const { data: role } = await supabase.from("roles").select("is_system").eq("id", data.roleId).maybeSingle();
    if (role?.is_system) throw new Error("No se pueden borrar roles del sistema");
    const { error } = await supabase.from("roles").delete().eq("id", data.roleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Bodega ============
export const updateBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    nombre: z.string().min(1).max(120),
    ubicacion: z.string().max(200).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const { error } = await supabase.from("bodegas").update({
      nombre: data.nombre,
      ubicacion: data.ubicacion ?? null,
    }).eq("id", data.bodegaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
