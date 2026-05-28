import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    // Check if user has at least one active membership; otherwise send to pending page.
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, estado")
      .eq("user_id", data.session.user.id)
      .eq("estado", "activo")
      .limit(1);

    if (!memberships || memberships.length === 0) {
      throw redirect({ to: "/pendiente" });
    }
  },
  component: () => <Outlet />,
});
