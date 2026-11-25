"use client";
import { useEffect } from "react";

// Si algo falla en una página se muestra esto en vez de la pantalla en blanco de Next.
// El caso más común: se publicó una versión nueva mientras la página estaba abierta (los archivos
// viejos ya no existen). Entonces se recarga sola una vez y el usuario ni se entera.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    const stale = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Failed to find Server Action/i.test(`${error.name} ${error.message}`);
    try {
      if (stale && !sessionStorage.getItem("reloaded-after-deploy")) {
        sessionStorage.setItem("reloaded-after-deploy", "1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem("reloaded-after-deploy");
    } catch { /* sin sessionStorage: se muestra el aviso */ }
  }, [error]);

  return (
    <div className="card mx-auto my-12 max-w-md space-y-4 text-center">
      <h1 className="text-xl font-bold">Algo salió mal al cargar esta página</h1>
      <p className="text-sm text-zinc-400">Puede que acabemos de publicar una actualización. Recarga la página para seguir.</p>
      <div className="flex justify-center gap-2">
        <button className="btn-primary" onClick={() => window.location.reload()}>Recargar</button>
        <button className="rounded-xl border border-line px-4 py-2 text-sm font-semibold" onClick={reset}>Reintentar</button>
      </div>
      {error.digest && <p className="text-xs text-zinc-600">Código: {error.digest}</p>}
    </div>
  );
}
