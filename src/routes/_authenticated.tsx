import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ActiveBodegaProvider } from "@/lib/active-bodega-context";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    // Check if user has at least one active membership; otherwise send to pending page.
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, estado")
      .eq("user_id", data.user.id)
      .eq("estado", "activo")
      .limit(1);

    if (!memberships || memberships.length === 0) {
      throw redirect({ to: "/pendiente" });
    }
  },
  component: () => (
    <ActiveBodegaProvider>
      <Outlet />
    </ActiveBodegaProvider>
  ),
});
