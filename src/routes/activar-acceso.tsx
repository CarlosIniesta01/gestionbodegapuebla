import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wine, LoaderCircle } from "lucide-react";

export const Route = createFileRoute("/activar-acceso")({
  head: () => ({ meta: [
    { title: "Activar acceso · Vinea Control" },
    { name: "description", content: "Activación segura de invitaciones de trabajadores de Vinea Control." },
    { property: "og:title", content: "Activar acceso · Vinea Control" },
    { property: "og:description", content: "Confirma tu acceso a los centros asignados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ActivarAcceso,
});

function ActivarAcceso() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Comprobando tu acceso…");
  const [busy, setBusy] = useState(true);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function activate() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("El enlace no es válido o ha caducado. Solicita otra invitación o inicia sesión con tu correo.");
      const result = await supabase.rpc("activar_invitaciones_trabajador");
      if (result.error) throw new Error(result.error.message);
      const { data: memberships, error: membershipError } = await supabase.from("memberships").select("id").eq("user_id", data.user.id).eq("estado", "activo").limit(1);
      if (membershipError) throw new Error(membershipError.message);
      if (!memberships?.length) throw new Error("Tu acceso sigue pendiente de autorización del administrador.");
      if (!cancelled) { setSuccess(true); setStatus("Acceso activado. Ya puedes entrar en Vinea Control."); }
    }
    activate().catch((e) => { if (!cancelled) setStatus(e.message); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);
  return <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div className="max-w-md space-y-5 text-center">
      <Wine className="size-10 text-primary mx-auto" />
      <h1 className="text-2xl font-semibold">Vinea Control</h1>
      {busy && <LoaderCircle className="size-6 animate-spin mx-auto" />}
      <p className="text-muted-foreground" role="status">{status}</p>
      {!busy && <Button onClick={() => navigate({ to: success ? "/" : "/login", search: success ? {} : { redirect: "/activar-acceso" } })}>{success ? "Entrar" : "Iniciar sesión"}</Button>}
    </div>
  </div>;
}