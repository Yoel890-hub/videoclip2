// Detección de momentos destacados a partir del volumen del audio (y del "lo más visto" de YouTube si existe).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

// Volumen (RMS en dB) de cada segundo del archivo. Devuelve un array con un valor por segundo.
export async function loudnessPerSecond(file) {
  const { stdout } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-ac", "1",
    "-af", "aresample=8000,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=-",
    "-f", "null", "-"], { timeout: 900_000, maxBuffer: 200_000_000 });
  const out = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/RMS_level=(-?[\d.]+|-?inf)/);
    if (m) out.push(m[1].includes("inf") ? -100 : Number(m[1]));
  }
  return out;
}

// Convierte el heatmap de YouTube ([{start_time, end_time, value}]) en un valor 0..1 por segundo.
export function heatPerSecond(heatmap, seconds) {
  const h = new Array(seconds).fill(0);
  for (const p of heatmap ?? []) {
    for (let s = Math.floor(p.start_time); s < Math.min(seconds, Math.ceil(p.end_time)); s++) h[s] = Math.max(h[s], p.value ?? 0);
  }
  return h;
}

/**
 * Elige `count` momentos de `dur` segundos.
 * Puntuación de cada ventana = volumen medio + subidas bruscas respecto a los 30 s anteriores (+ heatmap).
 * Se toman los mejores candidatos sin solaparse y se eligen al azar entre ellos, para que cada vez salgan clips distintos.
 * Devuelve los segundos de inicio, ordenados.
 */
export function pickMoments(rms, dur, count, { heat = null, skipStart = 5, random = Math.random } = {}) {
  const n = rms.length;
  if (n <= dur) return [0];
  const e = rms.map((v) => Math.min(1, Math.max(0, (v + 60) / 60)));       // -60 dB..0 dB → 0..1
  const pre = [0]; for (const v of e) pre.push(pre[pre.length - 1] + v);
  const avg = (a, b) => { a = Math.max(0, a); b = Math.min(n, b); return b > a ? (pre[b] - pre[a]) / (b - a) : 0; };
  const hp = heat ? [0] : null; if (heat) for (let i = 0; i < n; i++) hp.push(hp[i] + (heat[i] ?? 0));
  const havg = (a, b) => (b > a ? (hp[b] - hp[a]) / (b - a) : 0);

  const cands = [];
  for (let i = Math.min(skipStart, n - dur); i <= n - dur; i++) {
    const body = avg(i, i + dur);
    const punch = avg(i, i + Math.min(dur, 8)) - avg(i - 30, i);          // subida de volumen al empezar
    let score = body + 0.8 * Math.max(0, punch);
    if (hp) score += 0.6 * havg(i, i + dur);
    cands.push({ i, score });
  }
  cands.sort((a, b) => b.score - a.score);

  // Mejores ventanas sin solaparse (dejando hueco de media duración entre ellas).
  const gap = Math.max(5, Math.floor(dur / 2)), pool = [];
  for (const c of cands) {
    if (pool.length >= count * 3) break;
    if (pool.every((p) => Math.abs(p.i - c.i) >= dur + gap)) pool.push(c);
  }
  // Al azar entre los mejores, dando más probabilidad a los de más puntuación.
  const chosen = [];
  const left = [...pool];
  while (chosen.length < count && left.length) {
    const w = left.map((c, k) => 1 / (k + 1));
    let r = random() * w.reduce((a, b) => a + b, 0), k = 0;
    while (r > w[k] && k < left.length - 1) { r -= w[k]; k++; }
    chosen.push(left.splice(k, 1)[0].i);
  }
  return chosen.sort((a, b) => a - b);
}
