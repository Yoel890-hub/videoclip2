"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeftIcon } from "@/components/Icons";
import Logo from "@/components/Logo";
import { toLoginEmail } from "@/lib/users";

type Mode = "login" | "signup" | "reset";

// Traduce los errores más comunes de Supabase.
function traducir(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Usuario/correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Aún no has confirmado tu correo. Revisa tu bandeja de entrada (y la de spam).";
  if (m.includes("already registered")) return "Ya existe una cuenta con ese usuario o correo. Inicia sesión.";
  if (m.includes("at least 6") || m.includes("password should")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("rate limit")) return "Se han enviado demasiados correos. Espera un rato e inténtalo de nuevo.";
  if (m.includes("invalid") && m.includes("email")) return "Ese correo no es válido.";
  return msg;
}

export default function Login() {
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [mode, setMode] = useState<Mode>("login");
  // /login?modo=registro abre directamente "Crear cuenta" (botón "Probar gratis" de la portada).
  useEffect(() => { if (new URLSearchParams(location.search).get("modo") === "registro") setMode("signup"); }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const ref = () => new URLSearchParams(location.search).get("ref");
  const callback = (next?: string) => {
    const q = new URLSearchParams();
    const r = ref();
    if (r) q.set("ref", r);
    if (next) q.set("next", next);
    const s = q.toString();
    return `${location.origin}/auth/callback${s ? `?${s}` : ""}`;
  };

  const cambiar = (m: Mode) => { setMode(m); setError(""); setInfo(""); setPassword(""); setPassword2(""); };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (mode === "signup" && password !== password2) return setError("Las contraseñas no coinciden.");
    const id = toLoginEmail(email);
    if ("error" in id) return setError(id.error);
    if (mode === "reset" && id.isUsername) return setError("Las cuentas de usuario no tienen correo: para recuperar la contraseña pide ayuda al administrador.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: id.email, password });
        if (error) return setError(traducir(error.message));
        location.assign("/");
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email: id.email, password, options: { emailRedirectTo: callback() } });
        if (error) return setError(traducir(error.message));
        // Supabase no avisa si el correo ya existe: devuelve un usuario sin identidades.
        if (data.user && data.user.identities?.length === 0) return setError("Ya existe una cuenta con ese usuario o correo. Inicia sesión.");
        if (data.session) {
          const r = ref();
          if (r) await fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: r }) });
          location.assign("/");
        } else {
          setInfo("Cuenta creada. Te hemos enviado un correo para confirmarla: abre el enlace y después inicia sesión.");
          setMode("login");
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(id.email, { redirectTo: callback("/reset") });
        if (error) return setError(traducir(error.message));
        setInfo("Si existe una cuenta con ese correo, te hemos enviado un enlace para cambiar la contraseña.");
      }
    } catch {
      setError("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const titulo = mode === "login" ? "Entra en ClipLive" : mode === "signup" ? "Crea tu cuenta" : "Recupera tu contraseña";
  const boton = mode === "login" ? "Iniciar sesión" : mode === "signup" ? "Crear cuenta" : "Enviar enlace";

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 px-4 py-8">
      <a href="/bienvenida" className="inline-block text-xl"><Logo size={44} /></a>
      <h1 className="text-3xl font-extrabold sm:text-4xl">{titulo}</h1>

      {mode !== "reset" && (
        <div className="grid grid-cols-2 gap-2" role="tablist">
          <button type="button" role="tab" className="chip" aria-pressed={mode === "login"} aria-selected={mode === "login"} onClick={() => cambiar("login")}>Iniciar sesión</button>
          <button type="button" role="tab" className="chip" aria-pressed={mode === "signup"} aria-selected={mode === "signup"} onClick={() => cambiar("signup")}>Crear cuenta</button>
        </div>
      )}

      <form className="space-y-3" onSubmit={enviar}>
        <label className="block space-y-1">
          <span className="label">{mode === "reset" ? "Correo" : "Correo o usuario"}</span>
          <input className="input" type={mode === "reset" ? "email" : "text"} required autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder={mode === "reset" ? "tu@correo.com" : "tu@correo.com o tu usuario"} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        {mode !== "reset" && (
          <label className="block space-y-1">
            <span className="flex items-center justify-between">
              <span className="label">Contraseña</span>
              {mode === "login" && <button type="button" className="text-xs font-semibold text-accent" onClick={() => cambiar("reset")}>¿Olvidaste tu contraseña?</button>}
            </span>
            <div className="relative">
              <input className="input pr-20" type={showPw ? "text" : "password"} required minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Tu contraseña"} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute inset-y-0 right-3 text-xs font-semibold text-zinc-400 hover:text-zinc-200" onClick={() => setShowPw((v) => !v)}>
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
        )}

        {mode === "signup" && (
          <label className="block space-y-1">
            <span className="label">Repite la contraseña</span>
            <input className="input" type={showPw ? "text" : "password"} required minLength={6} autoComplete="new-password"
              value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </label>
        )}

        {error && <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}
        {info && <p className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300" role="status">{info}</p>}

        <button className="btn-primary w-full" disabled={busy}>{busy ? "Un momento…" : boton}</button>
      </form>

      {mode === "reset" ? (
        <button type="button" className="inline-flex w-full items-center justify-center gap-1 text-sm font-semibold text-zinc-400 hover:text-zinc-200" onClick={() => cambiar("login")}><ArrowLeftIcon />Volver a iniciar sesión</button>
      ) : process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true" && (
        <>
          <div className="flex items-center gap-3 text-xs text-zinc-500"><span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" /></div>
          <button type="button" className="btn-ghost w-full" onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } })}>
            Continuar con Google
          </button>
        </>
      )}
    </div>
  );
}
