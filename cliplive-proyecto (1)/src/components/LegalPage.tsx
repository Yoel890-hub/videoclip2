import Link from "next/link";
import Logo from "@/components/Logo";

// Contacto que se muestra en los textos legales: NEXT_PUBLIC_CONTACT_EMAIL en Render (si no, se pide escribir desde la web).
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";
export const LEGAL_UPDATED = "25 de noviembre de 2026";

export function Contact() {
  return CONTACT_EMAIL
    ? <a className="font-semibold text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    : <>los medios de contacto que aparecen en la web</>;
}

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/bienvenida" className="text-lg"><Logo size={32} /></Link>
      <h1 className="mt-8 text-3xl font-extrabold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Última actualización: {LEGAL_UPDATED}</p>
      <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-300">{children}</div>
      <p className="mt-12 border-t border-line pt-6 text-sm text-zinc-500">
        <Link href="/terminos" className="hover:text-zinc-300">Términos y condiciones</Link>
        {" · "}
        <Link href="/privacidad" className="hover:text-zinc-300">Política de privacidad</Link>
        {" · "}
        <Link href="/bienvenida" className="hover:text-zinc-300">Volver a ClipLive</Link>
      </p>
    </div>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-zinc-100">{n}. {title}</h2>
      {children}
    </section>
  );
}
