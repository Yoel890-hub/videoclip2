"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Nombre del clip con opción de renombrar, y botón de borrar con confirmación.
export default function ClipActions({ id, title, canDelete }: { id: string; title: string; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false), [name, setName] = useState(title);
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");

  const save = async () => {
    if (!name.trim() || name.trim() === title) { setEditing(false); setName(title); return; }
    setBusy(true); setErr("");
    const r = await fetch(`/api/clips/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: name }) });
    setBusy(false);
    if (!r.ok) return setErr((await r.json()).error ?? "No se pudo renombrar");
    setEditing(false); router.refresh();
  };
  const remove = async () => {
    setBusy(true); setErr("");
    const r = await fetch(`/api/clips/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { setConfirm(false); return setErr((await r.json()).error ?? "No se pudo borrar"); }
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {editing ? (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className="input py-2 text-sm" value={name} maxLength={120} autoFocus aria-label="Nombre del clip"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setName(title); } }} />
          <button className="btn-primary px-3 py-2 text-sm" disabled={busy}>Guardar</button>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 flex-1 text-sm font-semibold" title={title}>{title}</p>
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-card2 hover:text-zinc-200" aria-label="Renombrar clip" title="Renombrar">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
          {canDelete && (
            <button type="button" onClick={() => setConfirm(true)} className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-950/50 hover:text-red-300" aria-label="Borrar clip" title="Borrar">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
            </button>
          )}
        </div>
      )}
      {confirm && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-900/60 bg-red-950/30 p-2 text-sm" role="alertdialog" aria-label="Confirmar borrado">
          <span className="text-red-200">¿Borrar este clip? No se puede deshacer.</span>
          <span className="flex shrink-0 gap-1">
            <button type="button" className="rounded-lg px-2 py-1 font-semibold text-zinc-300 hover:bg-card2" onClick={() => setConfirm(false)}>No</button>
            <button type="button" className="rounded-lg bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-500" disabled={busy} onClick={remove}>{busy ? "…" : "Sí, borrar"}</button>
          </span>
        </div>
      )}
      {err && <p className="text-xs text-red-400" role="alert">{err}</p>}
    </div>
  );
}
