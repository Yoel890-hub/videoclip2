"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Crear" },
  { href: "/clips", label: "Tus clips" },
  { href: "/planes", label: "Planes" },
];

const isOn = (href: string, path: string) => (href === "/" ? path === "/" || path.startsWith("/nuevo") : path.startsWith(href));

// Línea naranja animada bajo la pestaña mientras carga la página nueva.
function Pending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`absolute inset-x-3 -bottom-[3px] h-0.5 rounded-full bg-accent transition-opacity duration-200 ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} />;
}

export default function NavLinks() {
  const path = usePathname();
  // La pestaña pulsada se marca al momento, sin esperar a que llegue la página.
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => setClicked(null), [path]);

  return (
    <nav className="flex min-w-0 items-center gap-0.5 rounded-xl border border-line bg-card p-1 text-[13px] font-semibold sm:gap-1 sm:text-sm">
      {LINKS.map((l) => {
        const on = clicked ? clicked === l.href : isOn(l.href, path);
        return (
          <Link key={l.href} href={l.href} prefetch aria-current={on ? "page" : undefined} onClick={() => setClicked(l.href)}
            className={`relative whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors duration-200 sm:px-3 ${on ? "bg-card2 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
            {l.label}
            <Pending />
          </Link>
        );
      })}
    </nav>
  );
}
