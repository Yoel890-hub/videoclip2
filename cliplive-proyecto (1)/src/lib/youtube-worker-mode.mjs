export const YOUTUBE_EXTERNAL_MARKER = "internal/youtube-worker-external";

let renderMode;
let renderModeExpiresAt = 0;

export async function youtubeWorkerMode(db) {
  if (process.env.YOUTUBE_WORKER_MODE) return process.env.YOUTUBE_WORKER_MODE;
  if (process.env.RENDER !== "true") return "direct";

  if (Date.now() < renderModeExpiresAt) return renderMode;
  const bucket = process.env.STORAGE_BUCKET || "clips";
  try {
    const { data } = await db.storage.from(bucket).exists(YOUTUBE_EXTERNAL_MARKER);
    renderMode = data ? "external" : "direct";
    renderModeExpiresAt = Date.now() + 15_000;
  } catch (error) {
    console.error("Configuración del worker de YouTube:", error.message);
  }
  return renderMode ?? "direct";
}
