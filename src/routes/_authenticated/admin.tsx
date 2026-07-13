import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Shield, Users, KeyRound, Building2, Plus, Trash2, Save, Beaker, UserCheck, UserX, Network, RotateCcw, LayoutDashboard, Package, ClipboardList, FileSearch, Inbox, Mail, Calendar, ChevronDown, ChevronRight, Download, Settings as SettingsIcon, Activity, Sparkles, AlertCircle, Search, Truck, FlaskConical } from "lucide-react";
import { ReinicioOperativoTab } from "@/components/admin/ReinicioOperativoTab";
import { ProcesosDocumentalesTab } from "@/components/admin/ProcesosDocumentalesTab";
import { PlantillasAnaliticaTab } from "@/components/admin/PlantillasAnaliticaTab";

import { ProductosTab } from "@/components/admin/ProductosTab";
import { ProductosComercialesTab } from "@/components/ProductosComercialesTab";
import { PerfilesAuditoriaTab } from "@/components/admin/PerfilesAuditoriaTab";
import { AuditoriaTab } from "@/components/admin/AuditoriaTab";
import { StockTab } from "@/components/admin/StockTab";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBodega } from "@/lib/active-bodega-context";

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

type SectionKey =
  | "dashboard"
  | "config"
  | "users"
  | "pending"
  | "roles"
  | "productos"
  | "productos-comerciales"
  | "stock"
  | "procesos-doc"
  | "plantillas-analitica"
  | "auditoria"
  | "perfiles-auditoria"
  | "reinicio"
  | "bodega";

type NavItem = { key: SectionKey; label: string; icon: typeof Shield };
type NavGroup = { key: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "general",
    label: "General",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "config", label: "Configuración del centro", icon: Building2 },
    ],
  },
  {
    key: "users",
    label: "Usuarios",
    items: [
      { key: "users", label: "Usuarios", icon: Users },
      { key: "pending", label: "Solicitudes", icon: Inbox },
      { key: "roles", label: "Roles y permisos", icon: KeyRound },
    ],
  },
  {
    key: "products",
    label: "Productos",
    items: [
      { key: "productos-comerciales", label: "Productos comerciales", icon: Package },
      { key: "productos", label: "Productos enológicos", icon: Beaker },
      { key: "stock", label: "Stock almacén", icon: ClipboardList },
    ],
  },
  {
    key: "security",
    label: "Seguridad",
    items: [
      { key: "auditoria", label: "Auditoría", icon: FileSearch },
      { key: "perfiles-auditoria", label: "Perfiles de auditoría", icon: Shield },
      { key: "reinicio", label: "Reinicio operativo", icon: RotateCcw },
      { key: "bodega", label: "Zona avanzada", icon: SettingsIcon },
    ],
  },
];

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
  const activeBodegaId =
    (ctxBodegaId && adminBodegas.find((b) => b.bodega_id === ctxBodegaId)?.bodega_id) ??
    adminBodegas[0]?.bodega_id ??
    null;
  const activeBodega = adminBodegas.find((b) => b.bodega_id === activeBodegaId);

  const [section, setSection] = useState<SectionKey>("dashboard");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    general: true, users: true, products: true, operativa: true, security: true,
  });

  if (bodegasQ.isLoading) {
    return <div className="p-6 text-muted-foreground">Cargando…</div>;
  }
  if (adminBodegas.length === 0) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-4">
        <div className="rounded-xl border bg-card p-10 text-center" style={{ borderColor: "var(--border)" }}>
          <Shield className="size-10 mx-auto mb-3 opacity-50" />
          <h1 className="text-xl font-semibold mb-1">Sin acceso de administración</h1>
          <p className="text-muted-foreground text-sm mb-4">No eres administrador de ninguna bodega.</p>
          <CreateBodegaButton onCreated={(id) => { setActiveBodegaId(id); bodegasQ.refetch(); refetchBodegas(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f6f7f9" }}>
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Administración</div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight truncate">
              Centro de Administración
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Configuración general, usuarios, permisos, seguridad y mantenimiento del ERP.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {adminBodegas.length > 1 && (
              <Select value={activeBodegaId ?? undefined} onValueChange={(v) => setActiveBodegaId(v)}>
                <SelectTrigger className="w-full sm:w-[220px] bg-white"><SelectValue placeholder="Bodega" /></SelectTrigger>
                <SelectContent>
                  {adminBodegas.map((b) => (
                    <SelectItem key={b.bodega_id} value={b.bodega_id}>{b.bodega.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <CreateBodegaButton onCreated={(id) => { setActiveBodegaId(id); bodegasQ.refetch(); refetchBodegas(); }} />
          </div>
        </header>

        {activeBodegaId && (
          <QuickActions
            onCreateUser={() => setSection("users")}
            onCreateRole={() => setSection("roles")}
            onExportAudit={() => setSection("auditoria")}
            onSettings={() => setSection("config")}
          />
        )}

        {activeBodegaId && (
          <AdminKpis bodegaId={activeBodegaId} onNavigate={setSection} />
        )}

        {activeBodegaId && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 lg:gap-6">
            <nav className="rounded-xl border bg-card p-2 h-fit lg:sticky lg:top-4" style={{ borderColor: "var(--border)" }}>
              {NAV_GROUPS.map((g) => {
                const open = openGroups[g.key] !== false;
                return (
                  <div key={g.key} className="mb-1">
                    <button
                      onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !open }))}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>{g.label}</span>
                      {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                    {open && (
                      <ul className="space-y-0.5">
                        {g.items.map((it) => {
                          const Icon = it.icon;
                          const active = section === it.key;
                          return (
                            <li key={it.key}>
                              <button
                                onClick={() => setSection(it.key)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                                  active
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-foreground/80 hover:bg-secondary/60"
                                }`}
                              >
                                <Icon className="size-4 shrink-0" />
                                <span className="truncate">{it.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>

            <main className="min-w-0 space-y-4">
              {section === "dashboard" && <AdminDashboard bodegaId={activeBodegaId} onNavigate={setSection} />}
              {section === "config" && <BodegaTab bodegaId={activeBodegaId} initial={activeBodega?.bodega} />}
              {section === "users" && <UsersTab bodegaId={activeBodegaId} />}
              {section === "pending" && <PendingTab bodegaId={activeBodegaId} />}
              {section === "roles" && <RolesTab bodegaId={activeBodegaId} />}
              {section === "productos" && <ProductosTab bodegaId={activeBodegaId} />}
              {section === "productos-comerciales" && <ProductosComercialesTab bodegaId={activeBodegaId} />}
              {section === "stock" && <StockTab bodegaId={activeBodegaId} />}
              {section === "procesos-doc" && <ProcesosDocumentalesTab bodegaId={activeBodegaId} />}
              {section === "plantillas-analitica" && <PlantillasAnaliticaTab bodegaId={activeBodegaId} />}
              {section === "auditoria" && <AuditoriaTab bodegaId={activeBodegaId} />}
              {section === "perfiles-auditoria" && <PerfilesAuditoriaTab bodegaId={activeBodegaId} />}
              {section === "reinicio" && <ReinicioOperativoTab />}
              {section === "bodega" && <BodegaTab bodegaId={activeBodegaId} initial={activeBodega?.bodega} />}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

// =================== QUICK ACTIONS ===================
function QuickActions({
  onCreateUser, onCreateRole, onExportAudit, onSettings,
}: {
  onCreateUser: () => void; onCreateRole: () => void;
  onExportAudit: () => void; onSettings: () => void;
}) {
  const actions = [
    { label: "Crear usuario", icon: UserCheck, onClick: onCreateUser },
    { label: "Crear rol", icon: KeyRound, onClick: onCreateRole },
    { label: "Exportar auditoría", icon: Download, onClick: onExportAudit },
    { label: "Configuración", icon: SettingsIcon, onClick: onSettings },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-secondary/60 transition-colors"
          style={{ borderColor: "var(--border)" }}
        >
          <a.icon className="size-4 text-primary" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

// =================== KPIs ===================
function AdminKpis({ bodegaId, onNavigate }: { bodegaId: string; onNavigate: (s: SectionKey) => void }) {
  const fnMembers = useServerFn(listMembers);
  const fnPending = useServerFn(listPendingUsers);
  const fnRoles = useServerFn(listRolesAndPerms);

  const membersQ = useQuery({ queryKey: ["admin", "members", bodegaId], queryFn: () => fnMembers({ data: { bodegaId } }) });
  const pendingQ = useQuery({ queryKey: ["admin", "pending", bodegaId], queryFn: () => fnPending({ data: { bodegaId } }) });
  const rolesQ = useQuery({ queryKey: ["admin", "rolesAndPerms", bodegaId], queryFn: () => fnRoles({ data: { bodegaId } }) });

  const countsQ = useQuery({
    queryKey: ["admin", "kpiCounts", bodegaId],
    queryFn: async () => {
      const [prodEnol, prodCom, contratosC, contratosV] = await Promise.all([
        supabase.from("productos").select("id", { count: "exact", head: true }).eq("bodega_id", bodegaId),
        supabase.from("productos_comerciales").select("id", { count: "exact", head: true }).eq("bodega_id", bodegaId),
        (supabase as any).from("contratos_compra").select("id", { count: "exact", head: true }).eq("bodega_id", bodegaId).eq("estado", "activo"),
        (supabase as any).from("contratos_venta").select("id", { count: "exact", head: true }).eq("bodega_id", bodegaId).eq("estado", "activo"),
      ]);
      return {
        prodEnol: prodEnol.count ?? 0,
        prodCom: prodCom.count ?? 0,
        contratos: (contratosC.count ?? 0) + (contratosV.count ?? 0),
      };
    },
  });

  const members = membersQ.data ?? [];
  const activos = members.filter((m: any) => m.estado === "activo").length;

  const kpis = [
    { label: "Usuarios activos", value: activos, icon: Users, tone: "blue" as const, onClick: () => onNavigate("users") },
    { label: "Solicitudes pendientes", value: pendingQ.data?.length ?? 0, icon: Inbox, tone: "amber" as const, onClick: () => onNavigate("pending") },
    { label: "Roles definidos", value: (rolesQ.data?.roles ?? []).length, icon: KeyRound, tone: "violet" as const, onClick: () => onNavigate("roles") },
    { label: "Productos enológicos", value: countsQ.data?.prodEnol ?? "—", icon: Beaker, tone: "teal" as const, onClick: () => onNavigate("productos") },
    { label: "Productos comerciales", value: countsQ.data?.prodCom ?? "—", icon: Package, tone: "indigo" as const, onClick: () => onNavigate("productos-comerciales") },
    { label: "Contratos activos", value: countsQ.data?.contratos ?? "—", icon: ClipboardList, tone: "emerald" as const, onClick: () => onNavigate("dashboard") },
    { label: "Auditoría", value: "Registro", icon: FileSearch, tone: "slate" as const, onClick: () => onNavigate("auditoria") },
    { label: "Alertas del sistema", value: 0, icon: AlertCircle, tone: "rose" as const, onClick: () => onNavigate("dashboard") },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
    </div>
  );
}

const TONE: Record<string, { bg: string; fg: string; bd: string }> = {
  blue:    { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
  amber:   { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  violet:  { bg: "#f5f3ff", fg: "#6d28d9", bd: "#ddd6fe" },
  teal:    { bg: "#ecfeff", fg: "#0e7490", bd: "#a5f3fc" },
  indigo:  { bg: "#eef2ff", fg: "#4338ca", bd: "#c7d2fe" },
  emerald: { bg: "#ecfdf5", fg: "#047857", bd: "#a7f3d0" },
  slate:   { bg: "#f1f5f9", fg: "#334155", bd: "#cbd5e1" },
  rose:    { bg: "#fff1f2", fg: "#be123c", bd: "#fecdd3" },
};

function KpiCard({
  label, value, icon: Icon, tone, onClick,
}: { label: string; value: number | string; icon: typeof Shield; tone: keyof typeof TONE; onClick?: () => void }) {
  const t = TONE[tone];
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border bg-card p-4 hover:shadow-sm transition-all hover:-translate-y-0.5"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-display font-semibold mt-1">{value}</div>
        </div>
        <span
          className="inline-flex items-center justify-center size-9 rounded-lg shrink-0"
          style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </button>
  );
}

// =================== ADMIN DASHBOARD ===================
function AdminDashboard({ bodegaId, onNavigate }: { bodegaId: string; onNavigate: (s: SectionKey) => void }) {
  const fnPending = useServerFn(listPendingUsers);
  const fnMembers = useServerFn(listMembers);
  const fnRoles = useServerFn(listRolesAndPerms);

  const pendingQ = useQuery({ queryKey: ["admin", "pending", bodegaId], queryFn: () => fnPending({ data: { bodegaId } }) });
  const membersQ = useQuery({ queryKey: ["admin", "members", bodegaId], queryFn: () => fnMembers({ data: { bodegaId } }) });
  const rolesQ = useQuery({ queryKey: ["admin", "rolesAndPerms", bodegaId], queryFn: () => fnRoles({ data: { bodegaId } }) });

  const pending = pendingQ.data ?? [];
  const members = membersQ.data ?? [];
  const roles = rolesQ.data?.roles ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AdminCard title="Solicitudes pendientes" icon={Inbox} action={pending.length ? { label: "Gestionar", onClick: () => onNavigate("pending") } : undefined}>
        {pending.length === 0 ? (
          <EmptyState icon={Sparkles} text="No existen solicitudes pendientes." />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {pending.slice(0, 5).map((u: any) => (
              <li key={u.user_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.nombre ?? u.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onNavigate("pending")}>Ver</Button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard title="Usuarios recientes" icon={Users} action={{ label: "Ver todos", onClick: () => onNavigate("users") }}>
        {members.length === 0 ? (
          <EmptyState icon={Users} text="Sin miembros aún." />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {members.slice(0, 5).map((m: any) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.profiles?.nombre ?? m.profiles?.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.profiles?.email}</div>
                </div>
                <Badge variant="outline" style={{ borderColor: m.roles?.color, color: m.roles?.color }}>
                  {m.roles?.nombre}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard title="Roles" icon={KeyRound} action={{ label: "Configurar", onClick: () => onNavigate("roles") }}>
        <div className="flex flex-wrap gap-2">
          {roles.map((r: any) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs"
              style={{ borderColor: r.color, color: r.color, background: `${r.color}10` }}
            >
              <span className="size-1.5 rounded-full" style={{ background: r.color }} />
              {r.nombre}
            </span>
          ))}
          {roles.length === 0 && <EmptyState icon={KeyRound} text="Sin roles definidos." />}
        </div>
      </AdminCard>

      <AdminCard title="Sistema" icon={Activity}>
        <ul className="text-sm space-y-2">
          <li className="flex items-center justify-between"><span className="text-muted-foreground">Estado</span><span className="font-medium text-emerald-700">Operativo</span></li>
          <li className="flex items-center justify-between"><span className="text-muted-foreground">Backend</span><span className="font-medium">Lovable Cloud</span></li>
          <li className="flex items-center justify-between"><span className="text-muted-foreground">Última auditoría</span>
            <button className="text-primary hover:underline font-medium" onClick={() => onNavigate("auditoria")}>Abrir registro</button>
          </li>
        </ul>
      </AdminCard>
    </div>
  );
}

function AdminCard({
  title, icon: Icon, action, children,
}: { title: string; icon: typeof Shield; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <header className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium truncate">{title}</h3>
        </div>
        {action && (
          <button onClick={action.onClick} className="text-xs font-medium text-primary hover:underline">
            {action.label}
          </button>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Shield; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="inline-flex items-center justify-center size-10 rounded-full bg-secondary/60 mb-3">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// =================== PENDING (rediseñado) ===================
function PendingTab({ bodegaId }: { bodegaId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listPendingUsers);
  const fnApprove = useServerFn(approvePendingUser);
  const fnReject = useServerFn(rejectPendingUser);
  const fnRoles = useServerFn(listRolesAndPerms);
  const [query, setQuery] = useState("");

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
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const operarioRole = (rolesQ.data?.roles ?? []).find((r: any) => r.key === "operario");
  const list = (pendingQ.data ?? []).filter((u: any) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (u.nombre ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 md:p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-medium">Solicitudes de acceso</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Al aprobar se asigna por defecto el rol <span className="text-foreground font-medium">operario</span>.
            </p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 sm:w-[260px] bg-white"
            />
          </div>
        </div>
      </div>

      {pendingQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center" style={{ borderColor: "var(--border)" }}>
          <span className="inline-flex items-center justify-center size-12 rounded-full bg-secondary/60 mb-3">
            <Inbox className="size-6 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">No existen solicitudes pendientes.</p>
          <p className="text-xs text-muted-foreground mt-1">Las nuevas solicitudes aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((u: any) => (
            <article key={u.user_id} className="rounded-xl border bg-card p-4 flex flex-col gap-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start gap-3 min-w-0">
                <span className="inline-flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                  {(u.nombre ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{u.nombre ?? u.email}</div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="size-3" /> {u.email}
                  </div>
                  {u.created_at && (
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="size-3" /> {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0">Pendiente</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  defaultValue={operarioRole?.id}
                  onValueChange={(v) => approveMut.mutate({ userId: u.user_id, roleId: v })}
                >
                  <SelectTrigger className="h-9 flex-1 min-w-[140px] bg-white"><SelectValue placeholder="Rol…" /></SelectTrigger>
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
                  <UserX className="size-4 mr-1" /> Rechazar
                </Button>
              </div>
            </article>
          ))}
        </div>
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

