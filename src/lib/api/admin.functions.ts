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
      .neq("estado", "rechazado")
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

    // Find user by email — first via profiles (fast), fallback to paginated auth admin
    const emailLower = data.email.toLowerCase();
    let target: { id: string; email?: string | null; user_metadata?: any } | undefined;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, nombre")
      .ilike("email", emailLower)
      .maybeSingle();

    if (prof) {
      target = { id: prof.user_id, email: prof.email, user_metadata: { nombre: prof.nombre } };
    } else {
      for (let page = 1; page <= 50; page++) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listErr) throw new Error(listErr.message);
        target = list.users.find((u) => (u.email ?? "").toLowerCase() === emailLower);
        if (target) break;
        if (list.users.length < 1000) break;
      }
    }
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

// ============ Pending users (registrados sin membership en esta bodega) ============
export const listPendingUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);

    // Existing members of this bodega
    const { data: members, error: mErr } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("bodega_id", data.bodegaId);
    if (mErr) throw new Error(mErr.message);
    const memberIds = new Set((members ?? []).map((m: any) => m.user_id));

    // All registered profiles
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, nombre, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (pErr) throw new Error(pErr.message);

    return (profs ?? []).filter((p: any) => !memberIds.has(p.user_id));
  });

export const approvePendingUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    userId: z.string().uuid(),
    roleId: z.string().uuid().optional(), // si no se pasa, se asigna "operario"
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);

    let roleId = data.roleId;
    if (!roleId) {
      const { data: role, error: rErr } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("bodega_id", data.bodegaId)
        .eq("key", "operario")
        .maybeSingle();
      if (rErr) throw new Error(rErr.message);
      if (!role) throw new Error("No existe el rol 'operario' en esta bodega.");
      roleId = role.id;
    }

    const { error } = await supabaseAdmin.from("memberships").upsert({
      user_id: data.userId,
      bodega_id: data.bodegaId,
      role_id: roleId,
      estado: "activo",
    }, { onConflict: "user_id,bodega_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectPendingUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    bodegaId: z.string().uuid(),
    userId: z.string().uuid(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);

    // Find the operario role just to satisfy the NOT NULL role_id
    const { data: role, error: rErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("bodega_id", data.bodegaId)
      .eq("key", "operario")
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!role) throw new Error("No existe el rol 'operario' en esta bodega.");

    const { error } = await supabaseAdmin.from("memberships").upsert({
      user_id: data.userId,
      bodega_id: data.bodegaId,
      role_id: role.id,
      estado: "rechazado",
    }, { onConflict: "user_id,bodega_id" });
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
    // Soft delete: marcamos como rechazado para que NO reaparezca como
    // solicitud pendiente y la decisión sea permanente.
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ estado: "rechazado" })
      .eq("id", data.membershipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============ Acceso multi-bodega ============
// Devuelve, para un usuario dado, las bodegas administradas por el admin
// actual junto con el estado de su membership en cada una (si existe).
export const listUserBodegaAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetUserId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Bodegas donde el admin actual es admin
    const { data: myAdmin, error: aErr } = await supabaseAdmin
      .from("memberships")
      .select("bodega_id, roles!inner(key), bodegas!inner(id, nombre)")
      .eq("user_id", userId)
      .eq("estado", "activo");
    if (aErr) throw new Error(aErr.message);
    const adminBodegas = (myAdmin ?? []).filter((m: any) => m.roles?.key === "admin");
    const bodegaIds = adminBodegas.map((m: any) => m.bodega_id);
    if (!bodegaIds.length) return [];

    const { data: targetMs, error: tErr } = await supabaseAdmin
      .from("memberships")
      .select("id, bodega_id, estado, role_id, roles(id, key, nombre, color)")
      .eq("user_id", data.targetUserId)
      .in("bodega_id", bodegaIds);
    if (tErr) throw new Error(tErr.message);

    const byBodega = new Map<string, any>();
    for (const m of targetMs ?? []) byBodega.set(m.bodega_id, m);

    return adminBodegas.map((b: any) => {
      const m = byBodega.get(b.bodega_id);
      return {
        bodega_id: b.bodega_id,
        bodega: b.bodegas,
        enabled: !!m && m.estado === "activo",
        membership_id: m?.id ?? null,
        role: m?.roles ?? null,
        estado: m?.estado ?? null,
      };
    });
  });

// Concede o revoca el acceso de un usuario a una bodega concreta.
// El admin actual debe ser admin de esa bodega.
export const setUserBodegaAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    targetUserId: z.string().uuid(),
    bodegaId: z.string().uuid(),
    enabled: z.boolean(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);

    if (data.enabled) {
      // Asignar rol "operario" por defecto si no existe el membership o si está revocado
      const { data: role, error: rErr } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("bodega_id", data.bodegaId)
        .eq("key", "operario")
        .maybeSingle();
      if (rErr) throw new Error(rErr.message);
      if (!role) throw new Error("No existe el rol 'operario' en esta bodega.");

      const { data: existing } = await supabaseAdmin
        .from("memberships")
        .select("id, role_id")
        .eq("user_id", data.targetUserId)
        .eq("bodega_id", data.bodegaId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("memberships")
          .update({ estado: "activo" })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("memberships").insert({
          user_id: data.targetUserId,
          bodega_id: data.bodegaId,
          role_id: role.id,
          estado: "activo",
        });
        if (error) throw new Error(error.message);
      }
    } else {
      // Revocar: soft delete (rechazado) para que no se cuele como pendiente
      const { error } = await supabaseAdmin
        .from("memberships")
        .update({ estado: "rechazado" })
        .eq("user_id", data.targetUserId)
        .eq("bodega_id", data.bodegaId);
      if (error) throw new Error(error.message);
    }
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

export const createBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    nombre: z.string().min(1).max(120),
    ubicacion: z.string().max(200).optional(),
    organizationNombre: z.string().max(120).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1) Reutilizar la primera organización del usuario si ya pertenece a alguna;
    //    si no, crear una nueva.
    const { data: existingMs, error: msErr } = await supabaseAdmin
      .from("memberships")
      .select("bodega_id, bodegas!inner(organization_id)")
      .eq("user_id", userId)
      .limit(1);
    if (msErr) throw new Error(msErr.message);

    let organizationId: string | undefined = (existingMs?.[0] as any)?.bodegas?.organization_id;
    if (!organizationId) {
      const { data: org, error: oErr } = await supabaseAdmin
        .from("organizations")
        .insert({ nombre: data.organizationNombre ?? "Mi Organización" })
        .select("id")
        .single();
      if (oErr) throw new Error(oErr.message);
      organizationId = org.id;
    }

    // 2) Crear la bodega
    const { data: bodega, error: bErr } = await supabaseAdmin
      .from("bodegas")
      .insert({
        organization_id: organizationId,
        nombre: data.nombre,
        ubicacion: data.ubicacion ?? null,
      })
      .select("id")
      .single();
    if (bErr) throw new Error(bErr.message);
    const bodegaId = bodega.id;

    // 3) Copiar roles del sistema (bodega_id IS NULL) a la nueva bodega
    const { data: sysRoles, error: srErr } = await supabaseAdmin
      .from("roles")
      .select("id, key, nombre, color, icono, descripcion, activo")
      .is("bodega_id", null);
    if (srErr) throw new Error(srErr.message);

    if (sysRoles && sysRoles.length) {
      const { error: insRolesErr } = await supabaseAdmin.from("roles").insert(
        sysRoles.map((r: any) => ({
          bodega_id: bodegaId,
          key: r.key,
          nombre: r.nombre,
          color: r.color,
          icono: r.icono,
          descripcion: r.descripcion,
          activo: r.activo,
          is_system: true,
        })),
      );
      if (insRolesErr) throw new Error(insRolesErr.message);

      // 4) Copiar role_permissions de los roles plantilla
      const sysRoleIds = sysRoles.map((r: any) => r.id);
      const { data: sysPerms, error: spErr } = await supabaseAdmin
        .from("role_permissions")
        .select("role_id, permission_key")
        .in("role_id", sysRoleIds);
      if (spErr) throw new Error(spErr.message);

      const { data: newRoles, error: nrErr } = await supabaseAdmin
        .from("roles")
        .select("id, key")
        .eq("bodega_id", bodegaId);
      if (nrErr) throw new Error(nrErr.message);
      const newRoleByKey: Record<string, string> = Object.fromEntries(
        (newRoles ?? []).map((r: any) => [r.key, r.id]),
      );
      const sysKeyById: Record<string, string> = Object.fromEntries(
        sysRoles.map((r: any) => [r.id, r.key]),
      );
      const rpRows = (sysPerms ?? [])
        .map((p: any) => ({
          role_id: newRoleByKey[sysKeyById[p.role_id]],
          permission_key: p.permission_key,
        }))
        .filter((r) => !!r.role_id);
      if (rpRows.length) {
        const { error: rpErr } = await supabaseAdmin.from("role_permissions").insert(rpRows);
        if (rpErr) throw new Error(rpErr.message);
      }

      // 5) Asignar admin al creador
      const adminRoleId = newRoleByKey["admin"];
      if (!adminRoleId) throw new Error("Plantilla de roles sin 'admin'");
      const { error: memErr } = await supabaseAdmin.from("memberships").insert({
        user_id: userId,
        bodega_id: bodegaId,
        role_id: adminRoleId,
        estado: "activo",
      });
      if (memErr) throw new Error(memErr.message);
    }

    return { id: bodegaId };
  });

export const deleteBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ bodegaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.bodegaId);
    const bId = data.bodegaId;

    // Borrado en cascada manual (no hay FKs declaradas).
    // 1) Datos dependientes de trabajos
    const { data: trabajos } = await supabaseAdmin.from("trabajos").select("id").eq("bodega_id", bId);
    const trabajoIds = (trabajos ?? []).map((t: any) => t.id);
    if (trabajoIds.length) {
      await supabaseAdmin.from("trabajo_eventos").delete().in("trabajo_id", trabajoIds);
      await supabaseAdmin.from("trabajo_asignados").delete().in("trabajo_id", trabajoIds);
    }
    await supabaseAdmin.from("trabajos").delete().eq("bodega_id", bId);

    // 2) Elaboraciones
    const { data: elabs } = await supabaseAdmin.from("elaboraciones").select("id").eq("bodega_id", bId);
    const elabIds = (elabs ?? []).map((e: any) => e.id);
    if (elabIds.length) {
      await supabaseAdmin.from("elaboracion_productos").delete().in("elaboracion_id", elabIds);
      await supabaseAdmin.from("elaboracion_depositos").delete().in("elaboracion_id", elabIds);
    }
    await supabaseAdmin.from("elaboraciones").delete().eq("bodega_id", bId);

    // 3) Recetas
    const { data: recetas } = await supabaseAdmin.from("recetas").select("id").eq("bodega_id", bId);
    const recetaIds = (recetas ?? []).map((r: any) => r.id);
    if (recetaIds.length) {
      await supabaseAdmin.from("receta_productos").delete().in("receta_id", recetaIds);
      await supabaseAdmin.from("receta_pasos").delete().in("receta_id", recetaIds);
      await supabaseAdmin.from("receta_depositos").delete().in("receta_id", recetaIds);
    }
    await supabaseAdmin.from("recetas").delete().eq("bodega_id", bId);
    await supabaseAdmin.from("familias_recetas").delete().eq("bodega_id", bId);

    // 4) Productos y mensajes
    await supabaseAdmin.from("productos").delete().eq("bodega_id", bId);
    await supabaseAdmin.from("mensajes").delete().eq("bodega_id", bId);

    // 5) Memberships y zonas
    const { data: ms } = await supabaseAdmin.from("memberships").select("id").eq("bodega_id", bId);
    const msIds = (ms ?? []).map((m: any) => m.id);
    if (msIds.length) {
      await supabaseAdmin.from("membership_zonas").delete().in("membership_id", msIds);
    }
    await supabaseAdmin.from("memberships").delete().eq("bodega_id", bId);

    // 6) Roles y permisos
    const { data: roles } = await supabaseAdmin.from("roles").select("id").eq("bodega_id", bId);
    const roleIds = (roles ?? []).map((r: any) => r.id);
    if (roleIds.length) {
      await supabaseAdmin.from("role_permissions").delete().in("role_id", roleIds);
    }
    await supabaseAdmin.from("roles").delete().eq("bodega_id", bId);

    // 7) La bodega
    const { error } = await supabaseAdmin.from("bodegas").delete().eq("id", bId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

