import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Shield, Users, KeyRound, Building2, Plus, Trash2, Save, Beaker, UserCheck, UserX, Network, RotateCcw } from "lucide-react";
import { ReinicioOperativoTab } from "@/components/admin/ReinicioOperativoTab";

import { ProductosTab } from "@/components/admin/ProductosTab";
import { ProductosComercialesTab } from "@/components/ProductosComercialesTab";
import { PerfilesAuditoriaTab } from "@/components/admin/PerfilesAuditoriaTab";
import { AuditoriaTab } from "@/components/admin/AuditoriaTab";
import { StockTab } from "@/components/admin/StockTab";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  listMyBodegas,
  listMembers,
  addMemberByEmail,
  updateMembership,
  removeMembership,
  listRolesAndPerms,
  toggleRolePermission,
  upsertRole,
  deleteRole,
  updateBodega,
  listPendingUsers,
  approvePendingUser,
  rejectPendingUser,
  createBodega,
  deleteBodega,
  listUserBodegaAccess,
  setUserBodegaAccess,
} from "@/lib/api/admin.functions";



import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Vinea Control" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fnListBodegas = useServerFn(listMyBodegas);
  const { bodegaId: ctxBodegaId, setActiveBodegaId, refetchBodegas } = useActiveBodega();
  const bodegasQ = useQuery({
    queryKey: ["admin", "bodegas"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Sesión no válida");
      return fnListBodegas();
    },
    retry: false,
  });

  const adminBodegas = useMemo(
    () => (bodegasQ.data ?? []).filter((b) => b.role_key === "admin"),
    [bodegasQ.data],
  );
  // Sincronizar con contexto: si el centro activo es admin, úsalo; si no, fallback al primero admin.
  const activeBodegaId =
    (ctxBodegaId && adminBodegas.find((b) => b.bodega_id === ctxBodegaId)?.bodega_id) ??
    adminBodegas[0]?.bodega_id ??
    null;
  const activeBodega = adminBodegas.find((b) => b.bodega_id === activeBodegaId);

  if (bodegasQ.isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando…</div>;
  }
  if (adminBodegas.length === 0) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-4">
        <div className="scada-panel p-10 text-center">
          <Shield className="size-10 mx-auto mb-3 opacity-50" />
          <h1 className="text-xl font-semibold mb-1">Sin acceso de administración</h1>
          <p className="text-muted-foreground text-sm mb-4">No eres administrador de ninguna bodega.</p>
          <CreateBodegaButton onCreated={(id) => { setActiveBodegaId(id); bodegasQ.refetch(); refetchBodegas(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Admin</div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Centro de control</h1>
          <p className="text-muted-foreground text-sm">Usuarios, roles, permisos y configuración.</p>
        </div>
        <div className="flex items-center gap-2">
          {adminBodegas.length > 1 && (
            <Select value={activeBodegaId ?? undefined} onValueChange={(v) => setActiveBodegaId(v)}>
              <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="Bodega" /></SelectTrigger>
              <SelectContent>
                {adminBodegas.map((b) => (
                  <SelectItem key={b.bodega_id} value={b.bodega_id}>{b.bodega.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <CreateBodegaButton onCreated={(id) => { setActiveBodegaId(id); bodegasQ.refetch(); refetchBodegas(); }} />
        </div>
      </div>


      {activeBodegaId && (
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-10 w-full md:w-auto">
            <TabsTrigger value="pending"><UserCheck className="size-4 mr-2" />Pendientes</TabsTrigger>
            <TabsTrigger value="users"><Users className="size-4 mr-2" />Usuarios</TabsTrigger>
            <TabsTrigger value="roles"><KeyRound className="size-4 mr-2" />Roles y permisos</TabsTrigger>
            <TabsTrigger value="productos"><Beaker className="size-4 mr-2" />Productos enológicos</TabsTrigger>
            <TabsTrigger value="stock"><Beaker className="size-4 mr-2" />Stock</TabsTrigger>
            <TabsTrigger value="productos-comerciales"><Beaker className="size-4 mr-2" />Productos comerciales</TabsTrigger>
            <TabsTrigger value="bodega"><Building2 className="size-4 mr-2" />Bodega</TabsTrigger>
            <TabsTrigger value="perfiles-auditoria"><Shield className="size-4 mr-2" />Perfiles auditoría</TabsTrigger>
            <TabsTrigger value="auditoria"><Shield className="size-4 mr-2" />Auditoría</TabsTrigger>
            <TabsTrigger value="reinicio"><RotateCcw className="size-4 mr-2" />Reinicio</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-6">
            <PendingTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UsersTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="roles" className="mt-6">
            <RolesTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="productos" className="mt-6">
            <ProductosTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="stock" className="mt-6">
            <StockTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="productos-comerciales" className="mt-6">
            <ProductosComercialesTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="bodega" className="mt-6">
            <BodegaTab bodegaId={activeBodegaId} initial={activeBodega?.bodega} />
          </TabsContent>
          <TabsContent value="perfiles-auditoria" className="mt-6">
            <PerfilesAuditoriaTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="auditoria" className="mt-6">
            <AuditoriaTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="reinicio" className="mt-6">
            <ReinicioOperativoTab />
          </TabsContent>



        </Tabs>
      )}
    </div>
  );
}

// =================== PENDING ===================
function PendingTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listPendingUsers);
  const fnApprove = useServerFn(approvePendingUser);
  const fnReject = useServerFn(rejectPendingUser);
  const fnRoles = useServerFn(listRolesAndPerms);

  const pendingQ = useQuery({
    queryKey: ["admin", "pending", bodegaId],
    queryFn: () => fnList({ data: { bodegaId } }),
  });
  const rolesQ = useQuery({
    queryKey: ["admin", "rolesAndPerms", bodegaId],
    queryFn: () => fnRoles({ data: { bodegaId } }),
  });

  const approveMut = useMutation({
    mutationFn: (vars: { userId: string; roleId?: string }) =>
      fnApprove({ data: { bodegaId, ...vars } }),
    onSuccess: () => {
      toast.success("Usuario aprobado y añadido como operario");
      qc.invalidateQueries({ queryKey: ["admin", "pending", bodegaId] });
      qc.invalidateQueries({ queryKey: ["admin", "members", bodegaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const rejectMut = useMutation({
    mutationFn: (vars: { userId: string }) =>
      fnReject({ data: { bodegaId, ...vars } }),
    onSuccess: () => {
      toast.success("Solicitud denegada");
      qc.invalidateQueries({ queryKey: ["admin", "pending", bodegaId] });
      qc.invalidateQueries({ queryKey: ["admin", "members", bodegaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const operarioRole = (rolesQ.data?.roles ?? []).find((r: any) => r.key === "operario");

  return (
    <div className="space-y-4">
      <div className="scada-panel p-4 md:p-5">
        <div className="text-sm font-medium mb-1">Solicitudes de acceso</div>
        <p className="text-xs text-muted-foreground">
          Usuarios registrados que aún no pertenecen a esta bodega. Al aprobar, se les asigna por defecto el rol
          <span className="text-foreground font-medium"> operario</span>. Al denegar, se marca como rechazado.
        </p>
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">
          Pendientes ({pendingQ.data?.length ?? 0})
        </div>
        <div className="divide-y divide-border">
          {pendingQ.isLoading && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">Cargando…</div>
          )}
          {pendingQ.data?.length === 0 && !pendingQ.isLoading && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No hay solicitudes pendientes
            </div>
          )}
          {(pendingQ.data ?? []).map((u: any) => (
            <div key={u.user_id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{u.nombre ?? u.email}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  defaultValue={operarioRole?.id}
                  onValueChange={(v) => approveMut.mutate({ userId: u.user_id, roleId: v })}
                >
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Aprobar con rol…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rolesQ.data?.roles ?? []).filter((r: any) => r.activo).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => approveMut.mutate({ userId: u.user_id, roleId: operarioRole?.id })}
                  disabled={approveMut.isPending || !operarioRole}
                >
                  <UserCheck className="size-4 mr-1" /> Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => rejectMut.mutate({ userId: u.user_id })}
                  disabled={rejectMut.isPending}
                >
                  <UserX className="size-4 mr-1" /> Denegar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================== USERS ===================
function UsersTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listMembers);
  const fnRoles = useServerFn(listRolesAndPerms);
  const fnAdd = useServerFn(addMemberByEmail);
  const fnUpdate = useServerFn(updateMembership);
  const fnRemove = useServerFn(removeMembership);

  const membersQ = useQuery({ queryKey: ["admin", "members", bodegaId], queryFn: () => fnList({ data: { bodegaId } }) });
  const rolesQ = useQuery({ queryKey: ["admin", "rolesAndPerms", bodegaId], queryFn: () => fnRoles({ data: { bodegaId } }) });

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");

  const addMut = useMutation({
    mutationFn: (vars: { email: string; roleId: string }) => fnAdd({ data: { bodegaId, ...vars } }),
    onSuccess: () => {
      toast.success("Usuario añadido");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "members", bodegaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { membershipId: string; roleId?: string; estado?: any }) =>
      fnUpdate({ data: { bodegaId, ...vars } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "members", bodegaId] }),
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const removeMut = useMutation({
    mutationFn: (membershipId: string) => fnRemove({ data: { bodegaId, membershipId } }),
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["admin", "members", bodegaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <div className="space-y-6">
      <div className="scada-panel p-4 md:p-5">
        <div className="text-sm font-medium mb-3">Añadir usuario</div>
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="email@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="md:flex-1"
          />
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="Rol" /></SelectTrigger>
            <SelectContent>
              {(rolesQ.data?.roles ?? []).filter((r: any) => r.activo).map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => addMut.mutate({ email, roleId })}
            disabled={!email || !roleId || addMut.isPending}
          >
            <Plus className="size-4 mr-1" /> Añadir
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          El usuario debe haber creado una cuenta previamente.
        </p>
      </div>

      <div className="scada-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-medium">
          Miembros ({membersQ.data?.length ?? 0})
        </div>
        <div className="divide-y divide-border">
          {(membersQ.data ?? []).map((m: any) => (
            <div key={m.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{m.profiles?.nombre ?? m.profiles?.email}</div>
                <div className="text-xs text-muted-foreground truncate">{m.profiles?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  style={{ borderColor: m.roles?.color, color: m.roles?.color }}
                >
                  {m.roles?.nombre}
                </Badge>
                <Select
                  value={m.role_id}
                  onValueChange={(v) => updateMut.mutate({ membershipId: m.id, roleId: v })}
                >
                  <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(rolesQ.data?.roles ?? []).filter((r: any) => r.activo).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={m.estado}
                  onValueChange={(v) => updateMut.mutate({ membershipId: m.id, estado: v })}
                >
                  <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="suspendido">Suspendido</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
                <BodegaAccessButton targetUserId={m.user_id} />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Perderá el acceso a la bodega. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeMut.mutate(m.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {membersQ.data?.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">Sin miembros</div>
          )}
        </div>
      </div>
    </div>
  );
}

// =================== ROLES ===================
function RolesTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listRolesAndPerms);
  const fnToggle = useServerFn(toggleRolePermission);
  const fnUpsert = useServerFn(upsertRole);
  const fnDelete = useServerFn(deleteRole);

  const q = useQuery({ queryKey: ["admin", "rolesAndPerms", bodegaId], queryFn: () => fnList({ data: { bodegaId } }) });

  const toggleMut = useMutation({
    mutationFn: (vars: { roleId: string; permissionKey: string; enabled: boolean }) =>
      fnToggle({ data: { bodegaId, ...vars } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "rolesAndPerms", bodegaId] }),
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const deleteMut = useMutation({
    mutationFn: (roleId: string) => fnDelete({ data: { bodegaId, roleId } }),
    onSuccess: () => {
      toast.success("Rol eliminado");
      qc.invalidateQueries({ queryKey: ["admin", "rolesAndPerms", bodegaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const selectedRole = q.data?.roles.find((r: any) => r.id === selectedRoleId) ?? q.data?.roles[0];
  const activeRoleId = selectedRole?.id;

  const permsByCat = useMemo(() => {
    const map = new Map<string, any[]>();
    (q.data?.permissions ?? []).forEach((p: any) => {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria)!.push(p);
    });
    return Array.from(map.entries());
  }, [q.data]);

  const rolePermSet = useMemo(() => {
    const s = new Set<string>();
    (q.data?.rolePerms ?? []).forEach((rp: any) => {
      if (rp.role_id === activeRoleId) s.add(rp.permission_key);
    });
    return s;
  }, [q.data, activeRoleId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <div className="scada-panel p-3 space-y-1 h-fit">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Roles</div>
          <RoleDialog
            bodegaId={bodegaId}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "rolesAndPerms", bodegaId] })}
          />
        </div>
        {(q.data?.roles ?? []).map((r: any) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoleId(r.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
              r.id === activeRoleId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="truncate">{r.nombre}</span>
            </div>
            {r.is_system && <span className="text-[10px] text-muted-foreground">sistema</span>}
          </button>
        ))}
      </div>

      <div className="scada-panel p-4 md:p-5">
        {selectedRole ? (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: selectedRole.color }} />
                  <h2 className="font-display text-lg font-semibold">{selectedRole.nombre}</h2>
                  {selectedRole.is_system && <Badge variant="outline">Sistema</Badge>}
                </div>
                {selectedRole.descripcion && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedRole.descripcion}</p>
                )}
              </div>
              <div className="flex gap-1">
                <RoleDialog
                  bodegaId={bodegaId}
                  role={selectedRole}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "rolesAndPerms", bodegaId] })}
                />
                {!selectedRole.is_system && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Los miembros asignados perderán sus permisos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMut.mutate(selectedRole.id)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            <div className="space-y-5">
              {permsByCat.map(([cat, perms]) => (
                <div key={cat}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">{cat}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => {
                      const enabled = rolePermSet.has(p.key);
                      const isAdminRole = selectedRole.key === "admin";
                      return (
                        <label
                          key={p.key}
                          className={`flex items-start gap-3 p-3 rounded-md border border-border ${
                            enabled ? "bg-primary/5 border-primary/30" : "bg-card"
                          } ${isAdminRole ? "opacity-60" : "cursor-pointer hover:bg-sidebar-accent/40"}`}
                        >
                          <Checkbox
                            checked={enabled}
                            disabled={isAdminRole}
                            onCheckedChange={(c) =>
                              toggleMut.mutate({
                                roleId: selectedRole.id,
                                permissionKey: p.key,
                                enabled: !!c,
                              })
                            }
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{p.label}</div>
                            {p.descripcion && (
                              <div className="text-xs text-muted-foreground">{p.descripcion}</div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Selecciona un rol</div>
        )}
      </div>
    </div>
  );
}

function RoleDialog({
  bodegaId, role, onSaved,
}: { bodegaId: string; role?: any; onSaved: () => void }) {
  const fnUpsert = useServerFn(upsertRole);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    key: role?.key ?? "",
    nombre: role?.nombre ?? "",
    color: role?.color ?? "#6b7280",
    icono: role?.icono ?? "Shield",
    descripcion: role?.descripcion ?? "",
    activo: role?.activo ?? true,
  });

  const mut = useMutation({
    mutationFn: () => fnUpsert({ data: { bodegaId, id: role?.id, ...form } as any }),
    onSuccess: () => {
      toast.success(role ? "Rol actualizado" : "Rol creado");
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const isSystem = role?.is_system;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={role ? "icon" : "sm"} variant={role ? "ghost" : "outline"}>
          {role ? <Save className="size-4" /> : <><Plus className="size-4 mr-1" />Nuevo</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{role ? "Editar rol" : "Nuevo rol"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Clave</Label>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} disabled={isSystem} />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Icono</Label>
              <Input value={form.icono} onChange={(e) => setForm({ ...form, icono: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.key || !form.nombre}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== BODEGA ===================

function BodegaTab({ bodegaId, initial }: { bodegaId: string; initial: any }) {
  const fn = useServerFn(updateBodega);
  const fnDelete = useServerFn(deleteBodega);
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [ubicacion, setUbicacion] = useState(initial?.ubicacion ?? "");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setNombre(initial?.nombre ?? "");
    setUbicacion(initial?.ubicacion ?? "");
  }, [initial?.nombre, initial?.ubicacion]);

  const mut = useMutation({
    mutationFn: () => fn({ data: { bodegaId, nombre, ubicacion } }),
    onSuccess: () => {
      toast.success("Bodega actualizada");
      qc.invalidateQueries({ queryKey: ["admin", "bodegas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const delMut = useMutation({
    mutationFn: () => fnDelete({ data: { bodegaId } }),
    onSuccess: () => {
      toast.success("Bodega eliminada");
      try { localStorage.removeItem(`vinea:map:v1:${bodegaId}`); } catch {}
      qc.invalidateQueries({ queryKey: ["admin", "bodegas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <div className="space-y-4 max-w-xl">
      <div className="scada-panel p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Ubicación</Label>
          <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !nombre}>
          <Save className="size-4 mr-1" /> Guardar
        </Button>
      </div>

      <div className="scada-panel p-5 border-destructive/40 space-y-3">
        <div>
          <div className="text-sm font-medium text-destructive">Zona peligrosa</div>
          <p className="text-xs text-muted-foreground">
            Eliminar la bodega borra de forma permanente miembros, roles, productos,
            recetas, elaboraciones, trabajos y mensajes asociados.
          </p>
        </div>
        <AlertDialog onOpenChange={() => setConfirmText("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="size-4 mr-1" /> Eliminar bodega
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar "{initial?.nombre}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es permanente. Para confirmar, escribe el nombre exacto de la bodega.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={initial?.nombre}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== (initial?.nombre ?? "") || delMut.isPending}
                onClick={() => delMut.mutate()}
              >
                Eliminar definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}



// =================== CREATE BODEGA ===================
function CreateBodegaButton({ onCreated }: { onCreated: (id: string) => void }) {
  const fn = useServerFn(createBodega);
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const mut = useMutation({
    mutationFn: () => fn({ data: { nombre, ubicacion: ubicacion || undefined } }),
    onSuccess: (res: any) => {
      toast.success("Bodega creada");
      setOpen(false);
      setNombre("");
      setUbicacion("");
      onCreated(res.id);
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="size-4 mr-1" /> Crear bodega</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear nueva bodega</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Bodega Principal" />
          </div>
          <div>
            <Label>Ubicación (opcional)</Label>
            <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ciudad / dirección" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!nombre || mut.isPending}>
            <Plus className="size-4 mr-1" /> Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// =================== BODEGA ACCESS (multi-bodega) ===================
function BodegaAccessButton({ targetUserId }: { targetUserId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listUserBodegaAccess);
  const fnSet = useServerFn(setUserBodegaAccess);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["admin", "userBodegaAccess", targetUserId],
    queryFn: () => fnList({ data: { targetUserId } }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: (vars: { bodegaId: string; enabled: boolean }) =>
      fnSet({ data: { targetUserId, ...vars } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "userBodegaAccess", targetUserId] });
      qc.invalidateQueries({ queryKey: ["admin", "members"] });
      qc.invalidateQueries({ queryKey: ["my-bodegas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" title="Acceso a bodegas">
          <Network className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="text-sm font-medium mb-2">Acceso a bodegas</div>
        <p className="text-xs text-muted-foreground mb-3">
          Marca las bodegas que este usuario podrá ver y operar.
        </p>
        {q.isLoading && <div className="text-xs text-muted-foreground">Cargando…</div>}
        {q.data?.length === 0 && (
          <div className="text-xs text-muted-foreground">No administras otras bodegas.</div>
        )}
        <div className="space-y-2 max-h-64 overflow-auto">
          {(q.data ?? []).map((row: any) => (
            <label key={row.bodega_id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={row.enabled}
                disabled={mut.isPending}
                onCheckedChange={(v) =>
                  mut.mutate({ bodegaId: row.bodega_id, enabled: !!v })
                }
              />
              <span className="flex-1 truncate">{row.bodega?.nombre}</span>
              {row.role?.nombre && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.role.nombre}
                </span>
              )}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

