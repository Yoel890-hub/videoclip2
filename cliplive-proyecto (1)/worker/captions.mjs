// Estilos de subtítulos con la palabra que se está diciendo resaltada (formato ASS, lo dibuja libass dentro de ffmpeg).
// Los ids deben coincidir con src/lib/captionStyles.ts (selector de la web).

// Colores web (#RRGGBB) → ASS (&HAABBGGRR, AA=00 opaco).
const ass = (hex, alpha = "00") => { const h = hex.replace("#", ""); return `&H${alpha}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase(); };

/**
 * mode: "line" = frase con la palabra activa resaltada · "word" = una palabra cada vez · "static" = frase sin resaltar
 * active: color de la palabra activa · bubble: color del "globo" detrás de la palabra activa · pop: escala al resaltar
 */
export const CAPTION_PRESETS = {
  clasico:  { font: "Arial Black", upper: true,  color: "#FFFFFF", outline: "#000000", bord: 0.07, mode: "static", words: 4 },
  verde:    { font: "Arial Black", upper: true,  color: "#FFFFFF", active: "#39FF14", outline: "#000000", bord: 0.07, pop: 115, mode: "line", words: 3 },
  palabra:  { font: "Arial Black", upper: true,  italic: true, color: "#4DFF2E", outline: "#000000", bord: 0.09, size: 1.35, pop: 112, mode: "word" },
  burbuja:  { font: "Arial Black", upper: true,  color: "#FFFFFF", active: "#FFFFFF", bubble: "#7C3AED", outline: "#000000", bord: 0.06, mode: "line", words: 3 },
  amarillo: { font: "Impact",      upper: true,  color: "#FFFFFF", active: "#FFE600", outline: "#000000", bord: 0.06, size: 1.15, mode: "line", words: 3 },
  fuego:    { font: "Arial Black", upper: false, color: "#FFD400", active: "#FF8A00", outline: "#D41515", bord: 0.09, pop: 110, mode: "line", words: 3 },
  elegante: { font: "Georgia",     upper: false, color: "#FFFFFF", active: "#E8B04A", outline: "#000000", bord: 0, shadow: 0.05, mode: "line", words: 4 },
  rosa:     { font: "Arial Black", upper: false, color: "#FFFFFF", active: "#1D4ED8", outline: "#F472B6", bord: 0.1, mode: "line", words: 3 },
  neon:     { font: "Arial Black", upper: false, color: "#B6FF3B", active: "#FFFFFF", outline: "#14532D", bord: 0.11, mode: "line", words: 3 },
  minimal:  { font: "Arial",       bold: true, upper: true, color: "#C8C8C8", active: "#5EEAD4", outline: "#000000", bord: 0, shadow: 0.03, size: 0.8, mode: "line", words: 5 },
  maquina:  { font: "Courier New", bold: true, upper: true, color: "#FFFFFF", active: "#FFF200", outline: "#000000", bord: 0.06, mode: "line", words: 3 },
  caja:     { font: "Arial",       bold: true, upper: false, color: "#9CA3AF", active: "#111111", box: "#E5E7EB", size: 0.9, mode: "line", words: 4 },
  magenta:  { font: "Arial Black", upper: true,  color: "#E040FB", outline: "#2A0033", bord: 0.08, size: 1.3, pop: 112, mode: "word" },
};
export const DEFAULT_CAPTION = "clasico";

// Las fuentes de Windows no existen en Linux (Render). Allí se usan equivalentes gratuitas casi idénticas,
// que scripts/render-setup.sh descarga en worker/fonts.
const LINUX_FONTS = { "Arial Black": "Archivo Black", Impact: "Anton", Georgia: "Gelasio", "Courier New": "Courier Prime", Arial: "Arimo" };
const fontName = (f) => (process.platform === "win32" ? f : LINUX_FONTS[f] ?? f);

const clean = (t) => t.replace(/[{}\\]/g, "").trim();
const ts = (ms) => {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
};

// Agrupa palabras en frases cortas: máx. N palabras, ~18 caracteres, y corta en pausas largas.
function groupWords(words, max) {
  const lines = []; let cur = [];
  for (const w of words) {
    const last = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= max || chars > 16 || w.start - last.end > 700)) { lines.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/**
 * words: [{ start, end, text }] en milisegundos · W×H: tamaño del vídeo final (ya recortado).
 * opts.faceBoxes(t0, t1 en s) → cajas de caras en el vídeo final: los subtítulos se colocan donde no tapen a nadie.
 */
export function buildAss(words, styleId, W, H, opts = {}) {
  const p = CAPTION_PRESETS[styleId] ?? CAPTION_PRESETS[DEFAULT_CAPTION];
  const vertical = H > W;
  const SIZE = { s: 0.8, m: 1, l: 1.25 };
  const fs = Math.round(Math.min(W * 0.088, H * 0.06) * (p.size ?? 1) * (SIZE[opts.size] ?? 1));
  const bord = Math.round(fs * (p.bord ?? 0)), shadow = Math.round(fs * (p.shadow ?? 0));
  const marginV = Math.round(H * (vertical ? 0.2 : 0.08));
  const boxed = !!p.box;
  const style = [
    "Default", fontName(p.font), fs,
    ass(p.color), ass(p.active ?? p.color), ass(boxed ? p.box : (p.outline ?? "#000000")), boxed ? ass(p.box) : ass("#000000", "80"),
    p.bold || p.font === "Arial Black" || p.font === "Impact" ? -1 : 0, p.italic ? -1 : 0, 0, 0, 100, 100, 0, 0,
    boxed ? 3 : 1, boxed ? Math.round(fs * 0.25) : bord, shadow, 2, Math.round(W * 0.06), Math.round(W * 0.06), marginV, 1,
  ].join(",");

  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${style}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const ws = words.map((w) => ({ ...w, text: clean(p.upper ? w.text.toUpperCase() : w.text) })).filter((w) => w.text);
  const ev = [];
  const popIn = p.pop ? `\\fscx100\\fscy100\\t(0,90,\\fscx${p.pop}\\fscy${p.pop})` : "";

  // ── Posición: abajo por defecto; si ahí hay una cara, en medio-abajo, arriba o medio-arriba ──
  const th = fs * 1.3 + bord * 2;
  const slots = vertical
    ? [{ id: "abajo", y2: H - marginV }, { id: "medio-abajo", y2: H * 0.68 }, { id: "arriba", y1: H * 0.1 }, { id: "medio-arriba", y1: H * 0.3 }]
    : [{ id: "abajo", y2: H - marginV }, { id: "arriba", y1: H * 0.06 }, { id: "medio-abajo", y2: H * 0.7 }];
  for (const sl of slots) { if (sl.y2 != null) sl.y1 = sl.y2 - th; else sl.y2 = sl.y1 + th; }
  let lastSlot = slots[0];
  const place = (t0, t1, plain) => {
    // Posición fija elegida por el usuario.
    if (opts.position === "middle") return `\\an5\\pos(${Math.round(W / 2)},${Math.round(H * 0.5)})`;
    if (opts.position === "top") return `\\an8\\pos(${Math.round(W / 2)},${Math.round(H * (vertical ? 0.12 : 0.06))})`;
    if (opts.position === "bottom" || !opts.faceBoxes) return "";
    const tw = Math.min(W * 0.9, plain.length * fs * 0.62);
    const x1 = W / 2 - tw / 2, x2 = W / 2 + tw / 2;
    const faces = opts.faceBoxes(t0 / 1000, t1 / 1000);
    const overlap = (sl) => faces.reduce((a, b) => a + Math.max(0, Math.min(x2, b.x2) - Math.max(x1, b.x1)) * Math.max(0, Math.min(sl.y2, b.y2) - Math.max(sl.y1, b.y1)), 0);
    // Abajo siempre que esté libre; si no, la posición anterior si sigue libre (para que no salte sin motivo).
    const order = [...new Set([slots[0], lastSlot, ...slots])];
    const best = order.find((x) => overlap(x) === 0) ?? order.reduce((a, b) => (overlap(b) < overlap(a) ? b : a));
    lastSlot = best;
    if (best === slots[0]) return "";                          // abajo: posición normal del estilo
    const top = best.id === "arriba" || best.id === "medio-arriba";
    return top ? `\\an8\\pos(${Math.round(W / 2)},${Math.round(best.y1)})` : `\\an2\\pos(${Math.round(W / 2)},${Math.round(best.y2)})`;
  };
  const tag = (t) => (t ? `{${t}}` : "");

  // Resaltado de la palabra activa dentro de la frase.
  const hi = (t) => {
    if (p.bubble) return `{\\3c${ass(p.bubble)}\\bord${Math.round(fs * 0.22)}\\c${ass(p.active)}${popIn}}${t}{\\r}`;
    if (p.active) return `{\\c${ass(p.active)}${popIn}}${t}{\\r}`;
    return t;
  };

  if (p.mode === "word") {
    // La posición se decide por grupos de 3 palabras para que no salte en cada palabra.
    for (const group of groupWords(ws, 3)) {
      const pos = place(group[0].start, group[group.length - 1].end, group.map((w) => w.text).reduce((a, b) => (b.length > a.length ? b : a)));
      for (const w of group) {
        const i = ws.indexOf(w);
        const end = Math.max(w.end, Math.min(w.start + 400, ws[i + 1]?.start ?? w.end + 400));
        ev.push(`Dialogue: 0,${ts(w.start)},${ts(end)},Default,,0,0,0,,{${pos}${popIn}}${w.text}`);
      }
    }
  } else {
    const lines = groupWords(ws, p.words ?? 3);
    for (const [li, line] of lines.entries()) {
      // La frase se queda un poco tras la última palabra, pero nunca se solapa con la siguiente.
      const nextStart = lines[li + 1]?.[0].start ?? Infinity;
      const lineEnd = Math.min(line[line.length - 1].end + 250, nextStart);
      const plain = line.map((w) => w.text).join(" ");
      const pos = tag(place(line[0].start, lineEnd, plain));
      if (p.mode === "static") {
        ev.push(`Dialogue: 0,${ts(line[0].start)},${ts(lineEnd)},Default,,0,0,0,,${pos}${plain}`);
        continue;
      }
      line.forEach((w, i) => {
        const start = i === 0 ? line[0].start : w.start;
        const end = i < line.length - 1 ? line[i + 1].start : lineEnd;
        const text = line.map((x, j) => (j === i ? hi(x.text) : x.text)).join(" ");
        ev.push(`Dialogue: 0,${ts(start)},${ts(end)},Default,,0,0,0,,${pos}${text}`);
      });
    }
  }
  return head + ev.join("\n") + "\n";
}

// Lee el JSON por líneas de Whisper (max_len=1 → una palabra por línea, { start, end, text } en ms).
export function parseWhisperWords(jsonl) {
  const out = [];
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const w = JSON.parse(line);
      const text = String(w.text ?? "").trim();
      if (text && Number.isFinite(w.start) && Number.isFinite(w.end)) out.push({ start: w.start, end: w.end, text });
    } catch { /* línea incompleta */ }
  }
  return out;
}
