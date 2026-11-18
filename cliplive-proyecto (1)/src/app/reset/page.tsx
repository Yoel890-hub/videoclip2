"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Llega aquí desde el enlace del correo "recuperar contraseña" (ya con la sesión iniciada).
export default function Reset() {
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message.toLowerCase().includes("different") ? "La nueva contraseña debe ser distinta de la anterior." : error.message);
    location.assign("/");
  }

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 px-4 py-8">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Nueva contraseña</h1>
      <form className="space-y-3" onSubmit={guardar}>
        <label className="block space-y-1">
          <span className="label">Contraseña nueva</span>
          <input className="input" type="password" required minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="label">Repítela</span>
          <input className="input" type="password" required minLength={6} autoComplete="new-password"
            value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </label>
        {error && <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </div>
  );
}
