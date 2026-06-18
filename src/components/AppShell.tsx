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
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard },
  { to: "/trabajos", label: "Trabajos", icon: Hammer },
  { to: "/pendientes", label: "Pendientes", icon: ListTodo },
  { to: "/actividad", label: "Actividad", icon: Activity },
  { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/recetas", label: "Recetas", icon: BookOpen },
  { to: "/bodega", label: "Bodega", icon: Boxes },
  { to: "/almacen", label: "Almacén enológico", icon: Beaker },
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
    <div className="min-h-screen flex flex-col md:flex-row text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-border">
          <div className="size-9 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Wine className="size-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold tracking-tight">Vinea Control</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Bodega Central</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent"
                  />
                )}
                <Icon className="size-[18px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="size-[18px]" />
            <span>Cerrar sesión</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3">
            <Circle className="size-2 fill-state-fermentacion text-state-fermentacion" />
            Sistema en línea
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Wine className="size-4 text-primary" />
          </div>
          <span className="font-display font-semibold tracking-tight">Vinea</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Circle className="size-1.5 fill-state-fermentacion text-state-fermentacion" />
            EN LÍNEA
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav - horizontal scroll para todos los items */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur border-t border-border">
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
                  active ? "text-accent" : "text-muted-foreground"
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
