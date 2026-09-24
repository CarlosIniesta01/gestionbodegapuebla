import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Clock, LogOut, Wine, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pendiente")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: "/" } });
    }
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, estado")
      .eq("user_id", data.session.user.id);

    const activa = memberships?.find((m) => m.estado === "activo");
    if (activa) throw redirect({ to: "/" });
  },
  component: PendientePage,
});

function PendientePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [rechazado, setRechazado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      if (data.user) {
        const { data: ms } = await supabase
          .from("memberships")
          .select("estado")
          .eq("user_id", data.user.id);
        setRechazado(!!ms?.some((m) => m.estado === "rechazado"));
      }
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", search: { redirect: "/" } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wine className="size-8 text-primary" />
          </div>
        </div>

        {rechazado ? (
          <>
            <div className="flex justify-center">
              <XCircle className="size-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold">Solicitud denegada</h1>
            <p className="text-muted-foreground">
              Tu solicitud de acceso ha sido denegada por la administración de la bodega.
              Si crees que es un error, contacta con el administrador.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Clock className="size-12 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Solicitud en revisión</h1>
            <p className="text-muted-foreground">
              Hemos recibido tu registro{email ? ` (${email})` : ""}. La administración de la
              bodega debe aprobar tu cuenta antes de que puedas acceder. Te avisaremos en
              cuanto esté lista.
            </p>
          </>
        )}

        <Button onClick={logout} variant="outline" className="w-full">
          <LogOut className="size-4 mr-2" /> Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
