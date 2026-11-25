import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { requireUser, getProfile } from "@/lib/supabase";
import { PLANS, TRIALS } from "@/lib/plans";
import NavLinks from "@/components/NavLinks";
import { isAdmin, isOwner } from "@/lib/admin";
import { displayName } from "@/lib/users";
import { ArrowRightIcon } from "@/components/Icons";
import Logo from "@/components/Logo";
import { SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"] });
const GOOGLE_RAW = (process.env.GOOGLE_SITE_VERIFICATION ?? "").trim();
const GOOGLE_CODE = GOOGLE_RAW.match(/content=["']([^"']+)/)?.[1] ?? GOOGLE_RAW.replace(/["'<>]/g, "");
const DESCRIPTION = "Saca clips de directos y vídeos de YouTube, Twitch, Kick y TikTok: verticales, con subtítulos y listos para redes en minutos.";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ClipLive · Clips de directos y vídeos listos para redes", template: "%s · ClipLive" },
  description: DESCRIPTION,
  applicationName: "ClipLive",
  keywords: ["clips de directos", "clips de Twitch", "clips de Kick", "clips de YouTube", "clips de TikTok", "subtítulos automáticos", "vídeos verticales", "TikTok", "Reels", "Shorts"],
  openGraph: { type: "website", siteName: "ClipLive", locale: "es_ES", url: "/bienvenida", title: "ClipLive · Clips de directos y vídeos listos para redes", description: DESCRIPTION, images: [{ url: "/logo.png", alt: "ClipLive" }] },
  twitter: { card: "summary", title: "ClipLive", description: DESCRIPTION, images: ["/logo.png"] },
  // Search Console → «Etiqueta HTML»: en GOOGLE_SITE_VERIFICATION (Render → Environment) vale el código o la etiqueta <meta …> entera.
  verification: GOOGLE_CODE ? { google: GOOGLE_CODE } : undefined,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const prof = user ? await getProfile(user.id) : null;
  const email = displayName(user?.email);
  const adm = isAdmin(user);
  const trialsLeft = prof ? Math.max(0, TRIALS - prof.trials_used) : 0;
  return (
    <html lang="es">
      <body className={inter.className}>
        {prof && (
          <>
            <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
                <Link href="/" className="text-lg"><Logo size={36} name="sm" /></Link>
                <NavLinks />
                <div className="flex items-center gap-2">
                  <Link href="/planes" className="hidden rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent sm:block">
                    {adm ? "Admin · ilimitado" : prof.plan === "trial" ? `${trialsLeft}/${TRIALS} pruebas` : `${prof.credits} créditos`}
                  </Link>
                  <details className="relative">
                    <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-line bg-card2 text-sm font-bold uppercase" title={email}>
                      {email.slice(0, 1) || "?"}
                    </summary>
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-card p-2 shadow-xl">
                      <p className="truncate px-2 py-1 text-xs text-zinc-400">{email}</p>
                      <p className="px-2 pb-2 text-xs text-zinc-500">{adm ? "Administrador · clips ilimitados" : `Plan ${PLANS[prof.plan as keyof typeof PLANS]?.name ?? prof.plan}${prof.manual_plan && prof.plan_expires_at ? ` · vence el ${new Date(prof.plan_expires_at).toLocaleDateString("es", { day: "numeric", month: "short" })}` : ""}`}</p>
                      {isOwner(user) && <Link href="/admin" className="block rounded-lg px-2 py-2 text-sm font-semibold hover:bg-card2">Administración</Link>}
                      <form action="/auth/signout" method="post">
                        <button className="w-full rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-card2">Cerrar sesión</button>
                      </form>
                    </div>
                  </details>
                </div>
              </div>
            </header>
            {prof.plan === "trial" && !adm && (
              <div className="border-b border-accent/20 bg-accent/5">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <p className="text-zinc-300">
                    <b className="text-accent">Modo prueba:</b> te quedan {trialsLeft} de {TRIALS} clips gratis · máx. {PLANS.trial.maxDuration} s y {PLANS.trial.maxQuality}p
                  </p>
                  <Link href="/planes" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">Mejorar plan <ArrowRightIcon /></Link>
                </div>
              </div>
            )}
          </>
        )}
        {/* Sin sesión, cada página (portada, login) decide su propio ancho. */}
        <main className={prof ? "mx-auto max-w-5xl px-4 py-8" : ""}>{children}</main>
      </body>
    </html>
  );
}
