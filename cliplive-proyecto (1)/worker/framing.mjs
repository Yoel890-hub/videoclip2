// Encuadre inteligente para vertical (9:16) y cuadrado (1:1).
// Detecta las caras (modelo UltraFace, MIT) en varios fotogramas por segundo y mueve el recorte para seguirlas
// con un movimiento suave; en los cambios de plano salta directamente. Sin caras, se queda en la última posición.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
const run = promisify(execFile);

const FACE_MODEL = process.env.FACE_MODEL || join(process.cwd(), "models", "ultraface-rfb-320.onnx");
let sessionP = null;
async function faceSession() {
  if (!sessionP) sessionP = (async () => {
    const ort = await import("onnxruntime-node");
    return { ort, s: await ort.InferenceSession.create(FACE_MODEL, { logSeverityLevel: 3 }) };
  })();
  return sessionP;
}
export const faceModelAvailable = () => existsSync(FACE_MODEL);

// Caras de un fotograma RGB 320×240 → [{ cx, cy, w, h, score }] normalizados 0..1 (tras NMS).
async function detectFaces(rgb) {
  const { ort, s } = await faceSession();
  const N = 320 * 240, data = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) data[c * N + i] = (rgb[i * 3 + c] - 127) / 128;
  const out = await s.run({ input: new ort.Tensor("float32", data, [1, 3, 240, 320]) });
  const scores = out.scores.data, boxes = out.boxes.data, n = scores.length / 2, cand = [];
  for (let i = 0; i < n; i++) {
    const sc = scores[i * 2 + 1];
    if (sc > 0.7) cand.push({ x1: boxes[i * 4], y1: boxes[i * 4 + 1], x2: boxes[i * 4 + 2], y2: boxes[i * 4 + 3], score: sc });
  }
  cand.sort((a, b) => b.score - a.score);
  const keep = [];
  const iou = (a, b) => {
    const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)), h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
    const inter = w * h; return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
  };
  for (const c of cand) if (keep.every((k) => iou(k, c) < 0.3)) keep.push(c);
  return keep.map((k) => ({ cx: (k.x1 + k.x2) / 2, cy: (k.y1 + k.y2) / 2, w: k.x2 - k.x1, h: k.y2 - k.y1, score: k.score }));
}

// Dónde centrar el recorte (0..1) para un fotograma: la cara más grande y las que quepan junto a ella.
function frameTarget(faces, cropFrac) {
  if (!faces.length) return null;
  const main = faces.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  const group = faces.filter((f) => Math.abs(f.cx - main.cx) < cropFrac / 2 && f.w * f.h > main.w * main.h * 0.25);
  const wsum = group.reduce((s, f) => s + f.w * f.h, 0);
  return group.reduce((s, f) => s + f.cx * f.w * f.h, 0) / wsum;
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

export async function videoSize(input) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", input], { timeout: 60_000 });
  const [w, h] = stdout.trim().split("x").map(Number);
  if (!(w > 0 && h > 0)) throw new Error("No se pudo leer el tamaño del vídeo");
  return { W: w, H: h };
}

// Tamaño del recorte para una proporción. null si no hace falta recortar en horizontal.
export function cropSize(W, H, aspect) {
  if (aspect === "9:16") { const cw = even(H * 9 / 16); return cw < W ? { cw, ch: even(H) } : null; }
  if (aspect === "1:1") { const s = even(Math.min(W, H)); return s < W ? { cw: s, ch: s } : null; }
  return null;
}

// Posición fija: izquierda, centro o derecha.
export function fixedX(W, cw, framing) {
  if (framing === "left") return 0;
  if (framing === "right") return (W - cw) - ((W - cw) % 2);
  return Math.floor((W - cw) / 4) * 2;   // centro, número par
}

/**
 * Caras de [ss, ss+len): { fps, frames } donde frames[i] = [{ cx, cy, w, h }] (0..1 sobre el vídeo original)
 * del fotograma en el segundo i / fps. Se usa para mover la cámara y para colocar los subtítulos sin tapar caras.
 */
export async function faceTimeline(input, { ss = 0, len }) {
  const fps = len > 120 ? 1 : len > 30 ? 2 : 4, FW = 320, FH = 240, frameBytes = FW * FH * 3;
  const frames = [];
  // Lee los fotogramas en streaming (no carga el vídeo entero en memoria).
  const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...(ss ? ["-ss", String(ss)] : []), "-i", input, "-t", String(len), "-an",
    "-vf", `fps=${fps},scale=${FW}:${FH},format=rgb24`, "-f", "rawvideo", "-"]);
  let buf = Buffer.alloc(0), frame = 0, queue = Promise.resolve();
  proc.stdout.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= frameBytes) {
      const img = buf.subarray(0, frameBytes); buf = buf.subarray(frameBytes);
      const idx = frame++;
      queue = queue.then(async () => { frames[idx] = await detectFaces(img); });
    }
  });
  await new Promise((res, rej) => { proc.on("error", rej); proc.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg salió con código ${code}`)))); });
  await queue;
  for (let i = 0; i < frames.length; i++) frames[i] ??= [];
  return { fps, frames };
}

/**
 * Plan de cámara como lo haría un editor (30 posiciones por segundo):
 *  - Sigue a una persona como mucho 3-5 s; luego corta a otra persona que esté en el vídeo (reacciones).
 *    Si no hay nadie más, corta a un plano del contenido (centro de la escena) y vuelve después.
 *  - Dentro de cada plano, seguimiento suave (zona muerta + muelle amortiguado).
 *  - Si la persona desaparece más de 2 s, se elige otra o se vuelve al centro.
 */
export function planCamera(tl, { W, cw, len, fps = 30, random = Math.random }) {
  const seconds = Math.max(1, Math.ceil(len));
  // Caras por segundo, en píxeles del vídeo original y sin duplicados.
  const perSec = Array.from({ length: seconds }, (_, s) => {
    const list = [];
    for (let i = s * tl.fps; i < Math.min(tl.frames.length, (s + 1) * tl.fps); i++)
      for (const f of tl.frames[i]) list.push({ x: f.cx * W, area: f.w * f.h });
    list.sort((a, b) => b.area - a.area);
    const uniq = [];
    for (const f of list) if (uniq.every((u) => Math.abs(u.x - f.x) > cw * 0.3)) uniq.push(f);
    return uniq;
  });
  if (perSec.every((v) => !v.length)) return null;            // sin caras en todo el clip

  const center = W / 2, far = cw * 0.5;
  const goals = new Array(seconds), cuts = new Set(), history = [];
  let cur = perSec.find((v) => v.length)?.[0].x ?? center, shotStart = 0, lastSeen = 0;
  let shotLen = 3 + random() * 2;                              // 3-5 s por plano
  const pickOther = (s) => {
    const alts = perSec[s].filter((f) => Math.abs(f.x - cur) > far);
    if (alts.length) {
      // Prioriza a quien no se ha visto en los últimos 10 s; después, la cara más grande.
      const recent = (x) => history.some((h) => s - h.s < 10 && Math.abs(h.x - x) < far);
      return (alts.find((f) => !recent(f.x)) ?? alts[0]).x;
    }
    return Math.abs(center - cur) > far ? center : null;       // nadie más: plano del contenido
  };

  for (let s = 0; s < seconds; s++) {
    const faces = perSec[s];
    const near = faces.filter((f) => Math.abs(f.x - cur) < cw * 0.6).sort((a, b) => Math.abs(a.x - cur) - Math.abs(b.x - cur))[0];
    if (near) { lastSeen = s; if (Math.abs(near.x - cur) > cw * 0.2) cur += (near.x - cur) * 0.6; }

    let next = null;
    if (s - shotStart >= shotLen) next = pickOther(s);                      // plano demasiado largo
    else if (s - lastSeen > 2) next = faces[0]?.x ?? (Math.abs(center - cur) > far ? center : null);   // persona perdida
    if (next != null && s > 0) {
      history.push({ s, x: cur });
      cur = next; shotStart = s; lastSeen = s; cuts.add(s);
      shotLen = 3 + random() * 2;
    } else if (s - shotStart >= shotLen) { shotStart = s; shotLen = 3 + random() * 2; }
    goals[s] = cur;
  }

  const clampX = (c) => Math.min(W - cw, Math.max(0, Math.round((c - cw / 2) / 2) * 2));
  const vmax = (cw * 0.35) / fps;
  const keys = []; let pos = goals[0], vel = 0;
  for (let i = 0; i < seconds * fps; i++) {
    const s = Math.min(seconds - 1, Math.floor(i / fps));
    if (i % fps === 0 && cuts.has(s)) { pos = goals[s]; vel = 0; }   // corte limpio a otra persona
    else {
      const accel = (goals[s] - pos) * 0.012 - vel * 0.2;            // muelle amortiguado
      vel = Math.max(-vmax, Math.min(vmax, vel + accel));
      pos += vel;
    }
    keys.push({ t: i / fps, x: clampX(pos) });
  }
  return keys;
}

/**
 * Cajas de las caras en el vídeo FINAL (ya recortado), para que los subtítulos no las tapen.
 * Devuelve (t0, t1 en segundos) → [{ x1, y1, x2, y2 }] en píxeles del vídeo final.
 */
export function faceBoxesFn(tl, { W, H, cropX, cw = W, ch = H, cropY = 0 }) {
  return (t0, t1) => {
    const out = [];
    const i0 = Math.max(0, Math.floor(t0 * tl.fps)), i1 = Math.min(tl.frames.length - 1, Math.ceil(t1 * tl.fps));
    for (let i = i0; i <= i1; i++) {
      const x0 = typeof cropX === "function" ? cropX(i / tl.fps) : cropX ?? 0;
      for (const f of tl.frames[i] ?? []) {
        // Margen extra: la caja del detector no incluye pelo ni barbilla.
        const bw = f.w * W * 1.3, bh = f.h * H * 1.5;
        const x1 = f.cx * W - bw / 2 - x0, x2 = x1 + bw, y1 = f.cy * H - bh / 2 - cropY, y2 = y1 + bh;
        if (x2 > 0 && x1 < cw && y2 > 0 && y1 < ch) out.push({ x1, y1, x2, y2 });
      }
    }
    return out;
  };
}

// Fichero de órdenes para ffmpeg (sendcmd) que va moviendo el filtro crop@fr.
export function sendcmdFile(keys) {
  const out = []; let last = null;
  for (const k of keys) { if (k.x !== last) { out.push(`${k.t.toFixed(3)} crop@fr x ${k.x};`); last = k.x; } }
  return out.join("\n") + "\n";
}
