"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";

export type CashRow = { id: string; name: string; plan: PlanId; credits: number; expiresAt: string };

const fmt = (d: string) => new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
const periodName = (m: number, n: number) => {
  const total = m * n;
  return total % 12 === 0 ? `${total / 12} ${total === 12 ? "año" : "años"}` : `${total} ${total === 1 ? "mes" : "meses"}`;
};

export default function CashPlans({ rows, setupError }: { rows: CashRow[]; setupError?: string }) {
  const router = useRouter();
  const [id, setId] = useState(""), [password, setPassword] = useState(""), [show, setShow] = useState(false);
  const [plan, setPlan] = useState<PlanId>("starter"), [periods, setPeriods] = useState(1);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string>();
  const p = PLANS[plan];

  async function give(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`¿Dar el plan ${p.name} durante ${periodName(p.months, periods)} a «${id.trim()}»? Cobra en efectivo $${p.price * periods}.`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password, plan, periods }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "No se pudo asignar el plan.");
      setMsg({ ok: true, text: `${j.created ? `Cuenta «${j.name}» creada. ` : ""}Plan ${j.plan} activado para «${j.name}» con ${j.credits} créditos (se recargan cada semana). Vence el ${fmt(j.endsAt)}.` });
      setId(""); setPassword(""); setPeriods(1);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally { setBusy(false); }
  }

  async function remove(r: CashRow) {
    if (!window.confirm(`¿Quitar ahora el plan ${PLANS[r.plan].name} a «${r.name}»? Su cuenta vuelve a Prueba.`)) return;
    setRemoving(r.id); setMsg(null);
    try {
      const res = await fetch("/api/admin/cash", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: r.id }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "No se pudo quitar el plan.");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally { setRemoving(undefined); }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Dar un plan pagado en efectivo</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Para clientes sin tarjeta ni PayPal. Escribe su <b>usuario o correo</b>. Si la cuenta <b>ya existe</b>, se le pone el plan y
            su contraseña no cambia. Si <b>no existe</b>, se crea con la contraseña que escribas. El plan se quita solo al vencer.
          </p>
        </div>
        {setupError && <p role="alert" className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">{setupError}</p>}
        <form onSubmit={give} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            <span>Usuario o correo del cliente</span>
            <input className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder="Juan23 o juan@correo.com" autoComplete="off" required />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Contraseña (solo si la cuenta es nueva, mín. 8)</span>
            <div className="flex gap-2">
              <input className="input" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
              <button type="button" className="rounded-xl border border-line px-3 text-xs" onClick={() => setShow(!show)}>{show ? "Ocultar" : "Ver"}</button>
            </div>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Plan</span>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
              {PAID_PLANS.map((k) => <option key={k} value={k}>{PLANS[k].name} · ${PLANS[k].price} cada {periodName(PLANS[k].months, 1)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>¿Cuántos periodos pagó?</span>
            <select className="input" value={periods} onChange={(e) => setPeriods(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} · {periodName(p.months, n)} · ${p.price * n}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <p className="text-sm text-zinc-300">Recibe <b>{p.weekly}</b> créditos cada semana · dura <b>{periodName(p.months, periods)}</b> · cobra <b>${p.price * periods}</b></p>
            <button className="btn-primary" disabled={busy || !id.trim()}>{busy ? "Guardando…" : "Dar plan"}</button>
          </div>
        </form>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Clientes en efectivo ({rows.length})</h2>
        {rows.length === 0 ? <p className="text-sm text-zinc-400">Todavía no hay ninguno.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const days = Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 864e5);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.name} · <span className="text-accent">{PLANS[r.plan]?.name ?? r.plan}</span></p>
                    <p className={`text-xs ${days <= 5 ? "text-amber-300" : "text-zinc-500"}`}>
                      Vence el {fmt(r.expiresAt)} ({days <= 0 ? "hoy" : `faltan ${days} ${days === 1 ? "día" : "días"}`}) · {r.credits} créditos
                    </p>
                  </div>
                  <button className="rounded-xl border border-red-900/60 px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-950/40"
                    disabled={removing === r.id} onClick={() => remove(r)}>{removing === r.id ? "Quitando…" : "Quitar plan"}</button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-zinc-500">Para renovar a un cliente, vuelve a darle el mismo plan: el tiempo se suma a partir de su vencimiento.</p>
      </section>
    </div>
  );
}
