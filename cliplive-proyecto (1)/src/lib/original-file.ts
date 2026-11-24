export const ORIGINAL_MAX_MB = 48;
export const ORIGINAL_MAX_BYTES = ORIGINAL_MAX_MB * 1024 * 1024;

export async function readOriginal(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ORIGINAL_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const data = Buffer.concat(chunks, size);
  const firstAtom = data.toString("ascii", 4, 8);
  return ["ftyp", "moov", "mdat", "wide", "free"].includes(firstAtom) ? data : null;
}
