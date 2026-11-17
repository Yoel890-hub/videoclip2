import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { sessionClient, admin } from "@/lib/supabase";
import { PLANS, TRIALS, type PlanId } from "@/lib/plans";

const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = { title: "ClipLive", description: "Saca clips de directos de YouTube, Twitch, Kick y TikTok" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data } = await (await sessionClient()).auth.getUser();
  const prof = data.user ? (await admin().from("profiles").select("plan,credits,trials_used").eq("id", data.user.id).single()).data : null;
  return (
    <html lang="es">
      <body className={inter.className}>
        {prof && (
          <>
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
              <Link href="/" className="text-lg font-extrabold">Clip<span className="text-accent">Live</span></Link>
              <nav className="flex items-center gap-3 text-sm font-semibold">
                <Link href="/clips">Tus clips</Link>
                <Link href="/planes" className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-accent">
                  {prof.plan === "trial" ? "Trial" : `${prof.credits} cr`}
                </Link>
              </nav>
            </header>
            {prof.plan === "trial" && (
              <div className="border-b border-amber-900/50 bg-amber-950/40 px-4 py-3 text-sm">
                <p>Modo trial limitado. Te quedan {Math.max(0, TRIALS - prof.trials_used)} de {TRIALS} pruebas gratis. El trial está limitado a {PLANS.trial.maxDuration} segundos y {PLANS.trial.maxQuality}p.</p>
                <Link href="/planes" className="btn-primary mt-2 w-full">Mejorar plan</Link>
              </div>
            )}
          </>
        )}
        <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
