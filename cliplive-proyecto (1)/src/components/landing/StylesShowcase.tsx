"use client";
import { useState } from "react";
import CaptionPicker from "@/components/CaptionPicker";

// Muestra de los estilos de subtítulos (interactiva, sin efecto real).
export default function StylesShowcase() {
  const [v, setV] = useState<string | null>("verde");
  return <CaptionPicker value={v} onChange={setV} />;
}
