"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Login() {
  const [email, setEmail] = useState(""), [msg, setMsg] = useState("");
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const redirectTo = () => {
    const ref = new URLSearchParams(location.search).get("ref");
    return `${location.origin}/auth/callback${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
  };
  return (
    <div className="mt-16 space-y-4">
      <h1 className="text-4xl font-extrabold">Entra en ClipLive</h1>
      <button className="btn-ghost w-full" onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } })}>Continuar con Google</button>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
        setMsg(error ? "No se pudo enviar el enlace." : "Te hemos enviado un enlace de acceso al correo.");
      }}>
        <input className="input" type="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-primary w-full">Enviar enlace de acceso</button>
      </form>
      {msg && <p className="text-sm text-zinc-400" role="status">{msg}</p>}
    </div>
  );
}
