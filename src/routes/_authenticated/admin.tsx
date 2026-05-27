import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Shield, Users, KeyRound, Building2, Plus, Trash2, Save, Check, X } from "lucide-react";
import { toast } from "sonner";

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
} from "@/lib/api/admin.functions";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Vinea Control" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fnListBodegas = useServerFn(listMyBodegas);
  const bodegasQ = useQuery({ queryKey: ["admin", "bodegas"], queryFn: () => fnListBodegas() });

  const adminBodegas = useMemo(
    () => (bodegasQ.data ?? []).filter((b) => b.role_key === "admin"),
    [bodegasQ.data],
  );
  const [bodegaId, setBodegaId] = useState<string | null>(null);
  const activeBodegaId = bodegaId ?? adminBodegas[0]?.bodega_id ?? null;
  const activeBodega = adminBodegas.find((b) => b.bodega_id === activeBodegaId);

  if (bodegasQ.isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando…</div>;
  }
  if (adminBodegas.length === 0) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <div className="scada-panel p-10 text-center">
          <Shield className="size-10 mx-auto mb-3 opacity-50" />
          <h1 className="text-xl font-semibold mb-1">Sin acceso de administración</h1>
          <p className="text-muted-foreground text-sm">No eres administrador de ninguna bodega.</p>
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
        {adminBodegas.length > 1 && (
          <Select value={activeBodegaId ?? undefined} onValueChange={setBodegaId}>
            <SelectTrigger className="w-full md:w-[260px]"><SelectValue placeholder="Bodega" /></SelectTrigger>
            <SelectContent>
              {adminBodegas.map((b) => (
                <SelectItem key={b.bodega_id} value={b.bodega_id}>{b.bodega.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {activeBodegaId && (
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="users"><Users className="size-4 mr-2" />Usuarios</TabsTrigger>
            <TabsTrigger value="roles"><KeyRound className="size-4 mr-2" />Roles y permisos</TabsTrigger>
            <TabsTrigger value="bodega"><Building2 className="size-4 mr-2" />Bodega</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6">
            <UsersTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="roles" className="mt-6">
            <RolesTab bodegaId={activeBodegaId} />
          </TabsContent>
          <TabsContent value="bodega" className="mt-6">
            <BodegaTab bodegaId={activeBodegaId} initial={activeBodega?.bodega} />
          </TabsContent>
        </Tabs>
      )}
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
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [ubicacion, setUbicacion] = useState(initial?.ubicacion ?? "");

  const mut = useMutation({
    mutationFn: () => fn({ data: { bodegaId, nombre, ubicacion } }),
    onSuccess: () => {
      toast.success("Bodega actualizada");
      qc.invalidateQueries({ queryKey: ["admin", "bodegas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <div className="scada-panel p-5 max-w-xl space-y-4">
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
  );
}
