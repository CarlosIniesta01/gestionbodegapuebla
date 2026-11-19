import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Wine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Acceso · Vinea Control" }, { name: "description", content: "Accede a Vinea Control con tu cuenta de trabajador." },
    { property: "og:title", content: "Acceso · Vinea Control" }, { property: "og:description", content: "Acceso seguro a los centros autorizados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") && !s.redirect.includes("\\") ? s.redirect : "/",
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const result = await supabase.rpc("activar_invitaciones_trabajador");
      if (result.error) throw new Error(result.error.message);
      throw redirect({ to: search.redirect || "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [bodega, setBodega] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nombre, bodega, organization: bodega }, emailRedirectTo: `${window.location.origin}/activar-acceso` },
        });
        if (error) throw error;
        if (!data.session) { setNotice("Revisa tu correo para confirmar tu cuenta antes de entrar."); return; }
      }
      const result = await supabase.rpc("activar_invitaciones_trabajador");
      if (result.error) throw new Error(result.error.message);
      navigate({ to: search.redirect || "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/activar-acceso`,
    });
    if (res.error) setError(res.error.message);
    else if (!res.redirected) navigate({ to: "/activar-acceso" });
  };

  const onEmailLink = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: {
      shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/activar-acceso`,
    } });
    if (error) setError(error.message);
    else setNotice("Revisa tu correo y abre el enlace para entrar.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md scada-panel p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="size-10 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Wine className="size-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold tracking-tight">Vinea Control</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
              {mode === "login" ? "Acceso" : "Crear cuenta"}
            </div>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full mb-4" onClick={onGoogle}>
          Continuar con Google
        </Button>
        <div className="flex items-center gap-3 mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> o <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bodega">Nombre de la bodega</Label>
                <Input id="bodega" value={bodega} onChange={(e) => setBodega(e.target.value)} required />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          {notice && <div className="text-sm text-muted-foreground" role="status">{notice}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
          {mode === "login" && <Button type="button" variant="outline" className="w-full" disabled={loading || !email} onClick={onEmailLink}>Entrar con enlace por correo</Button>}
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Entrar"}
        </button>
      </div>
    </div>
  );
}
