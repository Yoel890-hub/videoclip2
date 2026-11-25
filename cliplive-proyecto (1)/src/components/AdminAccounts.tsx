"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRow } from "@/lib/admin-users";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "nunca");

export default function AdminAccounts({ admins, me }: { admins: AdminRow[]; me: string }) {
  const router = useRouter();
  const [id, setId] = useState(""), [password, setPassword] = useState(""), [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string>();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "No se pudo completar.");
      setMsg({ ok: true, text: j.created
        ? `Cuenta de administrador «${j.name}» creada. Ya puede entrar con ese usuario y la contraseña que pusiste.`
        : `«${j.name}» ahora es administrador. Lo verá al volver a entrar (o en menos de 1 hora).` });
      setId(""); setPassword("");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally { setBusy(false); }
  }

  async function remove(a: AdminRow) {
    if (!window.confirm(`¿Quitar los permisos de administrador a «${a.name}»? La cuenta sigue existiendo como usuario normal.`)) return;
    setRemoving(a.id); setMsg(null);
    try {
      const r = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: a.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "No se pudo quitar.");
      setMsg({ ok: true, text: `«${a.name}» ya no es administrador (se aplica al volver a entrar o en menos de 1 hora).` });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally { setRemoving(undefined); }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Crear cuenta de administrador</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Escribe un <b>usuario</b> nuevo (por ejemplo <i>Maria23</i>) o un <b>correo</b> y una contraseña.
            Si la cuenta ya existe, solo se le dan los permisos de administrador y no hace falta contraseña.
          </p>
        </div>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="space-y-1 text-sm font-semibold">
            <span>Usuario o correo</span>
            <input className="input w-full" value={id} onChange={(e) => setId(e.target.value)} placeholder="Maria23" autoComplete="off" required />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Contraseña (mín. 8, solo para cuentas nuevas)</span>
            <div className="flex gap-2">
              <input className="input w-full" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password" minLength={8} placeholder="••••••••" />
              <button type="button" className="rounded-xl border border-line px-3 text-xs" onClick={() => setShow(!show)}>{show ? "Ocultar" : "Ver"}</button>
            </div>
          </label>
          <button className="btn-primary" disabled={busy || !id.trim()}>{busy ? "Guardando…" : "Hacer administrador"}</button>
        </form>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Administradores ({admins.length})</h2>
        <ul className="divide-y divide-line">
          {admins.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.name}{a.id === me && <span className="ml-2 text-xs text-zinc-500">(tú)</span>}</p>
                <p className="text-xs text-zinc-500">Creada el {fmt(a.createdAt)} · última entrada: {fmt(a.lastSignIn)}</p>
              </div>
              {a.fixed
                ? <span className="badge" title="Está en ADMIN_USERS de Render">Fijo</span>
                : a.id === me
                  ? <span className="text-xs text-zinc-500">No puedes quitarte a ti mismo</span>
                  : <button className="rounded-xl border border-red-900/60 px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-950/40"
                      disabled={removing === a.id} onClick={() => remove(a)}>{removing === a.id ? "Quitando…" : "Quitar administrador"}</button>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">Los administradores «Fijos» están en la variable ADMIN_USERS de Render: así nunca te quedas sin acceso.</p>
      </section>
    </div>
  );
}
