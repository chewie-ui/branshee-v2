import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientShares } from "@/db/schema";
import { requireContext } from "@/server/context";
import { readPrivateFile } from "@/server/storage";

/** Le pro télécharge un fichier qu'il a partagé avec un client. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; shareId: string }> }) {
  const ctx = await requireContext("customers.view");
  const { id, shareId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(shareId)) return new Response("Introuvable", { status: 404 });
  const [s] = await db.select().from(clientShares).where(and(eq(clientShares.id, shareId), eq(clientShares.customerId, id), eq(clientShares.businessId, ctx.business.id), eq(clientShares.kind, "file")));
  if (!s?.fileRef) return new Response("Introuvable", { status: 404 });
  const buf = await readPrivateFile(s.fileRef);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(s.fileName ?? "document")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
