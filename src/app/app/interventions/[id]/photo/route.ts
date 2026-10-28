import { requireContext } from "@/server/context";
import { interventionOf } from "@/server/interventions";
import { readPrivateFile, sniffImage } from "@/server/storage";

/** Photo d'une intervention (déchiffrée à la volée, réservée à l'équipe de l'entreprise). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const r = await interventionOf(ctx.business.id, (await params).id);
  const ref = new URL(req.url).searchParams.get("ref") ?? "";
  const p = r?.i.photos.find((x) => x.ref === ref);
  if (!p) return new Response("Introuvable", { status: 404 });
  const data = await readPrivateFile(p.ref).catch(() => null);
  const type = data ? sniffImage(data) : null;
  if (!data || !type) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
