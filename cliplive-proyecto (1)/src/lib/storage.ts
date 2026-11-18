import { admin } from "@/lib/supabase";

// Los clips se guardan en Supabase Storage (bucket privado) del mismo proyecto de Supabase.
export const BUCKET = process.env.STORAGE_BUCKET || "clips";

// Enlace temporal (10 min) que descarga el archivo con un nombre bonito.
export async function signedDownload(key: string, filename: string) {
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(key, 600, { download: filename });
  if (error || !data) throw new Error(`No se pudo firmar la descarga: ${error?.message}`);
  return data.signedUrl;
}

// Enlace temporal (1 h) para ver el clip en la página, sin forzar la descarga.
export async function signedView(key: string) {
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(key, 3600);
  if (error || !data) throw new Error(`No se pudo firmar la vista previa: ${error?.message}`);
  return data.signedUrl;
}
