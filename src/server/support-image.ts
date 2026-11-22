import "server-only";
import { savePrivateFile, sniffImage } from "@/server/storage";

const MAX_IMAGE = 8 * 1024 * 1024;

/** Image jointe à un message de support (capture d'écran…) : vérifiée puis enregistrée chiffrée. */
export async function storeSupportImage(file: FormDataEntryValue | null): Promise<{ ok: true; ref: string | null } | { ok: false; error: string }> {
  if (!(file instanceof File) || !file.size) return { ok: true, ref: null };
  if (file.size > MAX_IMAGE) return { ok: false, error: "Image trop lourde (8 Mo maximum)." };
  const data = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(data)) return { ok: false, error: "Seules les images sont acceptées (JPG, PNG, WebP, GIF)." };
  return { ok: true, ref: await savePrivateFile(data) };
}
