import { getSessionUser } from "@/server/auth/session";
import { markSharesSeen, myShare } from "@/server/client-account";
import { readPrivateFile } from "@/server/storage";

/** Fichier partagé par un pro, pour le client connecté (email vérifié, fiche rattachée à son compte). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSessionUser();
  if (!s?.user.emailVerifiedAt) return new Response("Connexion requise", { status: 401 });
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const share = await myShare(s.user.id, id);
  if (!share?.fileRef || share.kind !== "file") return new Response("Introuvable", { status: 404 });
  const buf = await readPrivateFile(share.fileRef);
  await markSharesSeen([share.id]);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(share.fileName ?? "document")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
