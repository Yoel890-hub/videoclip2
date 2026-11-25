"use client";
import { useEffect } from "react";

// Último recurso si falla incluso la estructura general de la web (cabecera, menú…).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    try {
      if (!sessionStorage.getItem("reloaded-after-deploy")) {
        sessionStorage.setItem("reloaded-after-deploy", "1");
        window.location.reload();
      }
    } catch { /* se muestra el aviso */ }
  }, [error]);
  return (
    <html lang="es">
      <body style={{ background: "#0b0b0f", color: "#f4f4f5", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Algo salió mal al cargar ClipLive</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14 }}>Puede que acabemos de publicar una actualización. Recarga la página para seguir.</p>
          <button onClick={() => window.location.reload()} style={{ background: "#ff6600", color: "#fff", border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>Recargar</button>
        </div>
      </body>
    </html>
  );
}
