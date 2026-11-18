"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Crear" },
  { href: "/clips", label: "Tus clips" },
  { href: "/planes", label: "Planes" },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex min-w-0 items-center gap-0.5 rounded-xl border border-line bg-card p-1 text-[13px] font-semibold sm:gap-1 sm:text-sm">
      {LINKS.map((l) => {
        const on = l.href === "/" ? path === "/" || path.startsWith("/nuevo") : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 transition sm:px-3 ${on ? "bg-card2 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
