import { readPublic } from "@/server/storage";

/** Images publiques envoyées depuis la v2 (logo, galerie, photos). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = await readPublic("media", (await params).path.join("/"));
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
