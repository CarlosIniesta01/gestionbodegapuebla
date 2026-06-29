import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Hammer,
  ListTodo,
  Activity,
  MessageSquare,
  BookOpen,
  Boxes,
  Beaker,
  Shield,
  Wine,
  Circle,
  LogOut,
  FileText,
  BarChart3,
  ClipboardList,
  GitCompare,
  Workflow,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { BodegaSwitcher } from "@/components/BodegaSwitcher";
import { GlobalSearch } from "@/components/GlobalSearch";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard },
  { to: "/operativa", label: "Operativa", icon: ClipboardList },
  { to: "/procesos", label: "Procesos", icon: Workflow },
  { to: "/trabajos", label: "Trabajos", icon: Hammer },
  { to: "/pendientes", label: "Pendientes", icon: ListTodo },
  { to: "/actividad", label: "Actividad", icon: Activity },
  { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/recetas", label: "Recetas", icon: BookOpen },
  { to: "/bodega", label: "Bodega", icon: Boxes },
  { to: "/almacen", label: "Almacén enológico", icon: Beaker },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/posicion-comercial", label: "Posición Comercial", icon: BarChart3 },
  { to: "/comparativa", label: "Comparativa", icon: GitCompare },
  { to: "/admin", label: "Admin", icon: Shield },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-foreground bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-4 flex items-center gap-2.5 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Wine className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold tracking-tight text-foreground">Vinea Control</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">Bodega Central</div>
          </div>
        </div>
        <div className="px-3 pt-3">
          <BodegaSwitcher />
        </div>
        <nav className="flex-1 p-2 pt-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/80 hover:text-foreground hover:bg-sidebar-accent"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary"
                  />
                )}
                <Icon className={`size-[17px] ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="size-[17px]" />
            <span>Cerrar sesión</span>
          </button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-3">
            <Circle className="size-2 fill-state-fermentacion text-state-fermentacion" />
            Sistema en línea
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary flex items-center justify-center">
            <Wine className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold tracking-tight text-foreground">Vinea</span>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <BodegaSwitcher compact />
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="hidden md:flex items-center justify-end gap-2 px-4 pt-3">
          <GlobalSearch />
        </div>
        <Outlet />
      </main>

      {/* Mobile bottom nav - horizontal scroll para todos los items */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur border-t border-sidebar-border">
        <div
          className="flex overflow-x-auto no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
        >
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2.5 px-4 text-[10px] shrink-0 min-w-[72px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                style={{ scrollSnapAlign: "start" }}
              >
                <Icon className="size-[18px]" />
                <span className="tracking-wide whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
