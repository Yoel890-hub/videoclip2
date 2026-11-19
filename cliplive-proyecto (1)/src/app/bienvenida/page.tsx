import type { Metadata } from "next";
import Link from "next/link";
import { PLANS, PAID_PLANS, TRIALS } from "@/lib/plans";
import PlanCard from "@/components/PlanCard";
import { CAPTION_STYLES } from "@/lib/captionStyles";
import PhoneDemo from "@/components/landing/PhoneDemo";
import Logo from "@/components/Logo";
import StylesShowcase from "@/components/landing/StylesShowcase";
import { ArrowRightIcon, CaptionsIcon, DownloadIcon, PlayIcon, SparklesIcon, VideoIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "ClipLive · Clips de directos y vídeos listos para redes",
  description: "Pega el enlace de un directo o vídeo de YouTube, Twitch, Kick o TikTok y consigue clips verticales con subtítulos en minutos.",
};

const SIGNUP = "/login?modo=registro";

export default function Bienvenida() {
  return (
    <div className="overflow-x-hidden">
      {/* Cabecera */}
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/bienvenida" className="text-lg"><Logo size={36} /></Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-400 md:flex">
            <a href="#como-funciona" className="hover:text-zinc-100">Cómo funciona</a>
            <a href="#funciones" className="hover:text-zinc-100">Funciones</a>
            <a href="#precios" className="hover:text-zinc-100">Precios</a>
            <a href="#preguntas" className="hover:text-zinc-100">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:text-white">Entrar</Link>
            <Link href={SIGNUP} className="btn-primary px-4 py-2 text-sm">Probar gratis</Link>
          </div>
        </div>
      </header>

      {/* Portada */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_400px_at_20%_0%,rgba(255,102,0,.18),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:grid-cols-[1.2fr_1fr] md:pt-20">
          <div>
            <p className="badge border-accent/40 text-accent"><SparklesIcon className="h-3 w-3" />Clips automáticos con IA</p>
            <h1 className="mt-4 text-[2.2rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Convierte tus directos en <span className="text-accent">clips virales</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-zinc-400">
              Pega el enlace de un directo o vídeo. ClipLive encuentra los mejores momentos, los pone en vertical siguiendo a las personas y añade subtítulos animados. Listos para TikTok, Reels y Shorts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={SIGNUP} className="btn-primary px-6 text-lg">Crear mi primer clip <ArrowRightIcon /></Link>
              <a href="#como-funciona" className="btn-ghost px-6 text-lg">Ver cómo funciona</a>
            </div>
            <p className="mt-4 text-sm text-zinc-500">{TRIALS} clips gratis · Sin tarjeta</p>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Funciona con</span>
              {["YouTube", "Twitch", "Kick", "TikTok"].map((p) => <span key={p} className="badge normal-case">{p}</span>)}
            </div>
          </div>
          <PhoneDemo />
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-20 border-t border-line/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle kicker="Cómo funciona" title="De un directo de horas a clips en minutos" />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: 1, t: "Pega el enlace", d: "De un directo en emisión o de un vídeo de YouTube. Comprobamos que se puede clipear al momento." },
              { n: 2, t: "Elige o deja que elijamos", d: "Marca tú el momento con la barra de tiempo, o pide los momentos destacados y los buscamos por ti." },
              { n: 3, t: "Descarga y publica", d: "En vertical, cuadrado u horizontal, con subtítulos y listo para subir. Lo ves antes de descargar." },
            ].map((s) => (
              <li key={s.n} className="card relative p-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-lg font-extrabold text-bg">{s.n}</span>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-2 text-zinc-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="scroll-mt-20 border-t border-line/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle kicker="Funciones" title="Todo lo que hace un editor, en automático" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { I: SparklesIcon, t: "Momentos destacados", d: "Analizamos el audio (gritos, risas, aplausos) y lo más visto en YouTube para encontrar los mejores momentos." },
              { I: VideoIcon, t: "Cámara inteligente", d: "El vertical sigue las caras y alterna entre las personas cada pocos segundos para mostrar las reacciones." },
              { I: CaptionsIcon, t: `${CAPTION_STYLES.length} estilos de subtítulos`, d: "Subtítulos automáticos con la palabra que se dice resaltada, que se colocan donde no tapan ninguna cara." },
              { I: PlayIcon, t: "Directos y vídeos", d: "Graba un directo desde ahora, retrocede en el directo o recorta cualquier parte de un vídeo de YouTube, Twitch o Kick." },
              { I: DownloadIcon, t: "Vista previa y descarga", d: "Mira el clip en la página antes de descargarlo. Se guarda 30 días en tu cuenta." },
              { I: CaptionsIcon, t: "Traducción al inglés", d: "Subtítulos en el idioma original o traducidos al inglés para llegar a más público." },
            ].map(({ I, t, d }) => (
              <div key={t} className="card p-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><I className="h-5 w-5" /></span>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-sm text-zinc-400">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <h3 className="text-2xl font-extrabold sm:text-3xl">Subtítulos que <span className="text-accent">enganchan</span></h3>
              <p className="mt-3 text-zinc-400">Elige entre {CAPTION_STYLES.length} estilos. Cada palabra se ilumina justo cuando se dice, como en los vídeos que más se comparten. Pulsa uno para verlo.</p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-3"><StylesShowcase /></div>
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="scroll-mt-20 border-t border-line/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle kicker="Precios" title="Empieza gratis, mejora cuando lo necesites" />
          <p className="mt-3 text-center text-zinc-400">Precios en dólares · Empieza con {TRIALS} clips gratis, sin tarjeta</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {PAID_PLANS.map((id) => (
              <PlanCard key={id} id={id} badge={id === "creator" ? "El más elegido" : id === "premium" ? "Mejor precio" : undefined}
                highlight={id === "premium"} href={SIGNUP} />
            ))}
          </div>
          <div className="card mx-auto mt-6 flex max-w-3xl flex-col items-center justify-between gap-3 p-5 sm:flex-row">
            <p className="text-center text-sm text-zinc-300 sm:text-left">
              <b className="text-zinc-100">Prueba gratis:</b> {TRIALS} clips de hasta {PLANS.trial.maxDuration} s en {PLANS.trial.maxQuality}p, con subtítulos y encuadre automático.
            </p>
            <Link href={SIGNUP} className="btn-ghost shrink-0 px-5 py-2 text-sm">Probar gratis</Link>
          </div>
        </div>
      </section>

      {/* Preguntas */}
      <section id="preguntas" className="scroll-mt-20 border-t border-line/60 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <SectionTitle kicker="Preguntas" title="Preguntas frecuentes" />
          <div className="mt-10 space-y-3">
            {[
              ["¿Necesito instalar algo?", "No. Todo funciona en el navegador, también desde el móvil."],
              ["¿De qué plataformas puedo sacar clips?", "Directos y vídeos de YouTube, Twitch y Kick, y directos de TikTok (TikTok bloquea la descarga de sus vídeos). También sirven los enlaces cortos que da el botón Compartir de TikTok."],
              ["¿Qué pasa si un clip falla?", "Te devolvemos automáticamente los créditos o la prueba gratis."],
              ["¿Cuánto tiempo se guardan mis clips?", "30 días. Puedes descargarlos, renombrarlos o borrarlos cuando quieras."],
              ["¿Puedo usar cualquier vídeo?", "Solo contenido que te pertenezca o que tengas permiso para usar. Respeta los derechos de autor y las normas de cada plataforma."],
            ].map(([q, a]) => (
              <details key={q} className="group card p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold">
                  {q}<span className="text-accent transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="px-5 pb-5 text-zinc-400">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Llamada final */}
      <section className="border-t border-line/60 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="glow rounded-3xl border border-accent/30 p-8 text-center sm:p-12">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Tu próximo clip viral empieza aquí</h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">Crea tu cuenta en segundos y prueba {TRIALS} clips gratis.</p>
            <Link href={SIGNUP} className="btn-primary mt-8 px-8 text-lg">Probar gratis <ArrowRightIcon /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/60 py-8 text-center text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} ClipLive · Respeta los derechos de autor del contenido que recortes.</p>
      </footer>
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <p className="label text-accent">{kicker}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

