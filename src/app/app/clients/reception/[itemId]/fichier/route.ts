import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { careInbox } from "@/db/schema";
import { requireContext } from "@/server/context";
import { readPrivateFile } from "@/server/storage";

/** Aperçu du PDF reçu, avant son intégration au dossier. */
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const ctx = await requireContext("records.view");
  const id = (await params).itemId;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const [r] = await db.select().from(careInbox).where(and(eq(careInbox.id, id), eq(careInbox.businessId, ctx.business.id)));
  if (!r?.filePath) return new Response("Introuvable", { status: 404 });
  const data = await readPrivateFile(r.filePath);
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(r.fileName ?? "document.pdf")}`, "Cache-Control": "private, no-store" } });
}
