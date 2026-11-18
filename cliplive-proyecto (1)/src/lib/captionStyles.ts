// Estilos de subtítulos para el selector de la web. Los ids deben coincidir con worker/captions.mjs,
// que es quien los dibuja de verdad en el vídeo. Aquí solo está la vista previa (aproximada) en CSS.
import type { CSSProperties } from "react";

export type CaptionStyle = {
  id: string; name: string;
  sample: [string, string, string?];   // palabras de ejemplo ("" al inicio = estilo de una sola palabra)
  base: CSSProperties; active?: CSSProperties;
};

const stroke = (px: number, color: string): CSSProperties => ({ WebkitTextStroke: `${px}px ${color}`, paintOrder: "stroke fill" });

export const CAPTION_STYLES: CaptionStyle[] = [
  { id: "clasico", name: "Clásico", sample: ["TU", "CLIP"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#fff", ...stroke(3, "#000") } },
  { id: "verde", name: "Verde pop", sample: ["TU", "CLIP"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#fff", ...stroke(3, "#000") },
    active: { color: "#39FF14", fontSize: "1.15em" } },
  { id: "palabra", name: "Una palabra", sample: ["", "CLIP"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, fontStyle: "italic", color: "#4DFF2E", fontSize: "1.35em", ...stroke(4, "#000") } },
  { id: "burbuja", name: "Burbuja", sample: ["TU", "CLIP"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#fff", ...stroke(3, "#000") },
    active: { background: "#7C3AED", borderRadius: 6, padding: "0 4px", WebkitTextStroke: "0" } },
  { id: "amarillo", name: "Amarillo", sample: ["TU", "CLIP"],
    base: { fontFamily: "Impact, 'Arial Narrow', sans-serif", color: "#fff", fontSize: "1.15em", letterSpacing: ".5px", ...stroke(3, "#000") },
    active: { color: "#FFE600" } },
  { id: "fuego", name: "Fuego", sample: ["tu", "clip"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#FFD400", ...stroke(5, "#D41515") },
    active: { color: "#FF8A00", fontSize: "1.1em" } },
  { id: "elegante", name: "Elegante", sample: ["tu", "clip"],
    base: { fontFamily: "Georgia, 'Times New Roman', serif", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,.8)" },
    active: { color: "#E8B04A" } },
  { id: "rosa", name: "Rosa", sample: ["tu", "clip"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#fff", ...stroke(5, "#F472B6") },
    active: { color: "#1D4ED8" } },
  { id: "neon", name: "Neón", sample: ["tu", "clip"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#B6FF3B", ...stroke(6, "#14532D") },
    active: { color: "#fff" } },
  { id: "minimal", name: "Minimal", sample: ["TU", "CLIP"],
    base: { fontFamily: "Arial, sans-serif", fontWeight: 700, color: "#C8C8C8", fontSize: ".8em", letterSpacing: ".5px", textShadow: "0 1px 2px rgba(0,0,0,.8)" },
    active: { color: "#5EEAD4" } },
  { id: "maquina", name: "Máquina", sample: ["TU", "CLIP"],
    base: { fontFamily: "'Courier New', monospace", fontWeight: 700, color: "#fff", ...stroke(3, "#000") },
    active: { color: "#FFF200" } },
  { id: "caja", name: "Caja blanca", sample: ["tu", "clip"],
    base: { fontFamily: "Arial, sans-serif", fontWeight: 700, color: "#9CA3AF", background: "#E5E7EB", padding: "2px 8px", borderRadius: 4, fontSize: ".9em" },
    active: { color: "#111" } },
  { id: "magenta", name: "Magenta", sample: ["", "CLIP"],
    base: { fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#E040FB", fontSize: "1.3em", ...stroke(4, "#2A0033") } },
];

export const CAPTION_IDS = CAPTION_STYLES.map((s) => s.id);
export const DEFAULT_CAPTION = "clasico";

// ── Estilos por plan: cada plan tiene los suyos y todos los de los planes inferiores ──
export type Tier = "trial" | "starter" | "creator" | "pro" | "premium";
const TIER_ORDER: Tier[] = ["trial", "starter", "creator", "pro", "premium"];
export const TIER_NAME: Record<Tier, string> = { trial: "Prueba", starter: "Starter", creator: "Creator", pro: "Pro", premium: "Premium" };
export const CAPTION_TIER: Record<string, Tier> = {
  clasico: "trial",                                                       // gratis: 1 estilo
  verde: "starter", palabra: "starter", amarillo: "starter", minimal: "starter",       // Starter: 5
  burbuja: "creator", fuego: "creator", elegante: "creator", maquina: "creator",       // Creator: 9
  rosa: "pro", caja: "pro",                                               // Pro: 11
  neon: "premium", magenta: "premium",                                    // Premium: los 13
};
const rank = (t: string) => Math.max(0, TIER_ORDER.indexOf(t as Tier));
export const captionAllowed = (plan: string, styleId: string) => rank(plan) >= rank(CAPTION_TIER[styleId] ?? "premium");
export const captionsForPlan = (plan: string) => CAPTION_IDS.filter((id) => captionAllowed(plan, id)).length;

// Opciones extra de los subtítulos.
export const SUB_SIZES = [["s", "Pequeño"], ["m", "Mediano"], ["l", "Grande"]] as const;
export const SUB_POSITIONS = [["auto", "Automática", "Evita las caras"], ["bottom", "Abajo", ""], ["middle", "Centro", ""], ["top", "Arriba", ""]] as const;
export const SUB_LANGS = [["original", "Idioma original", ""], ["en", "Inglés", "Traducido"]] as const;
export const subOpt = (v: unknown, list: readonly (readonly string[])[], def: string) => (list.some((o) => o[0] === v) ? (v as string) : def);
