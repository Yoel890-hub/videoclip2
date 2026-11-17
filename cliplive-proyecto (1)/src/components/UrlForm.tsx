"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UrlForm() {
  const [url, setUrl] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      const r = await fetch("/api/probe", { method: "POST", body: JSON.stringify({ url }) });
      const j = await r.json(); setBusy(false);
      if (!r.ok) return setErr(j.error);
      sessionStorage.setItem("probe", JSON.stringify(j));
      router.push("/nuevo");
    }}>
      <input className="input" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} required />
      <p className="text-sm text-red-400" role="alert">{err}</p>
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Verificando…" : "Verificar"}</button>
    </form>
  );
}
