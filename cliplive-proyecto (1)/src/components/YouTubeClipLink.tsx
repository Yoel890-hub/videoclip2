import { detectPlatform } from "@/lib/platforms";

export default function YouTubeClipLink({ url }: { url: string }) {
  if (detectPlatform(url)?.platform !== "youtube") return null;
  const source = new URL(url);
  const parts = source.pathname.split("/");
  const id = source.hostname === "youtu.be" ? parts[1]
    : source.pathname === "/watch" ? source.searchParams.get("v")
    : ["shorts", "live", "embed"].includes(parts[1]) ? parts[2] : null;
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  return (
    <div className="space-y-1 text-sm">
      <a className="font-semibold text-accent underline" href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank" rel="noopener noreferrer">Abrir vídeo en YouTube</a>
      <p className="text-zinc-400">Si el vídeo admite clips, elige «Recortar» para compartir un fragmento de 5 a 60 segundos por enlace.</p>
    </div>
  );
}
