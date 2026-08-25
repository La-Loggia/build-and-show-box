import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          void navigate({ to: "/admin" });
          return;
        }
        setMessage("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/admin" });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la operación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-auth">
      <form className="admin-card admin-auth__form" onSubmit={submit}>
        <h1>Panel de administración</h1>
        <p>{mode === "signin" ? "Accede con tu cuenta de administrador." : "Crea la cuenta de administrador (la primera cuenta registrada será la administradora)."}</p>
        <label>Correo
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>Contraseña
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        </label>
        <button className="admin-primary" type="submit" disabled={busy}>
          {busy ? "Procesando…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
        </button>
        {message && <p className="admin-message" role="alert">{message}</p>}
        <button className="admin-link" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
          {mode === "signin" ? "Crear la cuenta de administrador" : "Ya tengo cuenta"}
        </button>
      </form>
    </main>
  );
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso al panel — miDGT UI" },
      { name: "description", content: "Acceso privado al panel de gestión de usuarios de la app miDGT UI." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Acceso al panel — miDGT UI" },
      { property: "og:description", content: "Acceso privado al panel de gestión de usuarios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});
