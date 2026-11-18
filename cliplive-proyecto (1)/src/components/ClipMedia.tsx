"use client";
import { useEffect, useRef, useState } from "react";

// Vídeo o imagen del clip: muestra un esqueleto con brillo hasta que el archivo está listo, y entra con un fundido.
export default function ClipMedia({ kind, src, frame }: { kind: "video" | "image"; src: string; frame: string }) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLVideoElement & HTMLImageElement>(null);

  // Si ya estaba en caché del navegador, el evento de carga pudo ocurrir antes de montar el componente.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((kind === "video" && (el as HTMLVideoElement).readyState >= 2) || (kind === "image" && (el as HTMLImageElement).complete)) setReady(true);
  }, [kind]);

  return (
    <div className={`relative w-full ${frame}`}>
      {!ready && <div className="skeleton absolute inset-0 rounded-none" aria-hidden />}
      {kind === "video" ? (
        <video ref={ref} className={`block h-full w-full bg-black object-contain transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          src={src} controls playsInline preload="metadata" onLoadedData={() => setReady(true)} onError={() => setReady(true)} />
      ) : (
        <img ref={ref} className={`block h-full w-full object-contain transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          src={src} alt="Captura del clip" onLoad={() => setReady(true)} onError={() => setReady(true)} />
      )}
    </div>
  );
}
