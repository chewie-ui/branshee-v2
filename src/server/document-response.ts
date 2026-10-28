import "server-only";
import { INLINE_TYPES } from "@/server/documents";
import { readPrivateFile } from "@/server/storage";

/** Réponse de téléchargement sûre : PDF, images et texte affichés ; tout le reste en pièce jointe, jamais interprété. */
export async function fileResponse(d: { fileRef: string; name: string; mime: string }, download = false) {
  const data = await readPrivateFile(d.fileRef).catch(() => null);
  if (!data) return new Response("Introuvable", { status: 404 });
  const inline = !download && INLINE_TYPES.has(d.mime);
  const type = d.mime === "text/plain" ? "text/plain; charset=utf-8" : INLINE_TYPES.has(d.mime) ? d.mime : "application/octet-stream";
  const ascii = d.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Pas de « sandbox » pour les PDF : Chrome refuse alors de les afficher.
      ...(d.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
    },
  });
}
