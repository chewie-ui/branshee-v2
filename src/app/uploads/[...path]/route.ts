import { readPublic } from "@/server/storage";

/** Fichiers publics de l'ancien Branshee (photos, logos…), à leur ancienne adresse /uploads/…, pour que rien ne casse. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = await readPublic("legacy", (await params).path.join("/"));
  if (!file || file.type === "application/pdf") return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.type === "image/svg+xml" ? "text/plain" : file.type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
