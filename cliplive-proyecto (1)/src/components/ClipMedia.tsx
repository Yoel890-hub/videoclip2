"use client";
import { useEffect, useRef, useState } from "react";

// Vídeo o imagen del clip: muestra un esqueleto con brillo hasta que hay algo que ver, y entra con un fundido.
// Los vídeos llevan portada (poster): los móviles no cargan la imagen del vídeo hasta darle a reproducir,
// y sin portada se veía un recuadro negro.
export default function ClipMedia({ kind, src, poster, frame }: { kind: "video" | "image"; src: string; poster?: string; frame: string }) {
  const [ready, setReady] = useState(false);
  const [posterOk, setPosterOk] = useState(!!poster);
  const ref = useRef<HTMLVideoElement & HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Si ya estaba en caché del navegador, el evento de carga pudo ocurrir antes de montar el componente.
    if ((kind === "video" && (el as HTMLVideoElement).readyState >= 2) || (kind === "image" && (el as HTMLImageElement).complete)) setReady(true);
    if (kind !== "video" || !poster) return;
    // La portada se carga aparte: en cuanto está, se muestra (no hace falta esperar al vídeo).
    const img = new Image();
    img.onload = () => setReady(true);
    img.onerror = () => setPosterOk(false);   // clip antiguo sin portada: se espera al vídeo como antes
    img.src = poster;
    const t = setTimeout(() => setReady(true), 4000);   // nunca dejar el esqueleto para siempre
    return () => clearTimeout(t);
  }, [kind, poster]);

  return (
    <div className={`relative w-full ${frame}`}>
      {!ready && <div className="skeleton absolute inset-0 rounded-none" aria-hidden />}
      {kind === "video" ? (
        <video ref={ref} className={`block h-full w-full bg-black object-contain transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          src={src} poster={posterOk ? poster : undefined} controls playsInline preload={posterOk ? "none" : "metadata"}
          onLoadedData={() => setReady(true)} onError={() => setReady(true)} />
      ) : (
        <img ref={ref} className={`block h-full w-full object-contain transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          src={src} alt="Captura del clip" onLoad={() => setReady(true)} onError={() => setReady(true)} />
      )}
    </div>
  );
}
