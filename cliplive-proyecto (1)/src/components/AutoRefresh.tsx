"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
// Mientras haya clips en curso, recarga los datos del servidor cada 4 s.
export default function AutoRefresh({ active }: { active: boolean }) {
  const r = useRouter();
  useEffect(() => { if (!active) return; const t = setInterval(() => r.refresh(), 2500); return () => clearInterval(t); }, [active, r]);
  return null;
}
