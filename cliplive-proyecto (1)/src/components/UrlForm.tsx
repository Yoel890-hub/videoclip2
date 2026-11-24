"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon } from "@/components/Icons";
import YouTubeClipLink from "@/components/YouTubeClipLink";
import Link from "next/link";

export default function UrlForm() {
  const [url, setUrl] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const router = useRouter();
  const [fallbackUrl, setFallbackUrl] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(""); setFallbackUrl("");
      try {
        const r = await fetch("/api/probe", { method: "POST", body: JSON.stringify({ url }) });
        const j = await r.json();
        if (!r.ok) {
          if (r.status === 503) setFallbackUrl(url);
          return setErr(j.error);
        }
        sessionStorage.setItem("probe", JSON.stringify(j));
        router.push("/nuevo");
      } catch {
        setErr("Se interrumpió la consulta. Vuelve a comprobar el enlace.");
      } finally {
        setBusy(false);
      }
    }}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input sm:flex-1" type="url" placeholder="Pega el enlace aquí…" value={url} onChange={(e) => setUrl(e.target.value)} required aria-label="Enlace del directo o vídeo" />
        <button className="btn-primary sm:px-6" disabled={busy}>
          {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-bg/40 border-t-bg" aria-hidden />Comprobando…</> : <>Continuar <ArrowRightIcon /></>}
        </button>
      </div>
      {err && <p className="text-sm text-red-400" role="alert">{err}</p>}
      <Link href="/nuevo?origen=archivo" className="btn-ghost">Crear clip desde mi archivo</Link>
      {fallbackUrl && <YouTubeClipLink url={fallbackUrl} />}
    </form>
  );
}
