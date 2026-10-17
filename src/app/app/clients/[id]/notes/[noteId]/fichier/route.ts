import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customerNotes, customers } from "@/db/schema";
import { requireContext } from "@/server/context";
import { readPrivateFile } from "@/server/storage";

/** Pièce jointe d'une note du dossier : déchiffrée à la volée, réservée à l'équipe autorisée. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const ctx = await requireContext("customers.view");
  const p = z.object({ id: z.uuid(), noteId: z.uuid() }).safeParse(await params);
  if (!p.success) return new Response("Introuvable", { status: 404 });
  const [row] = await db
    .select({ path: customerNotes.attachmentPath, name: customerNotes.attachmentName })
    .from(customerNotes)
    .innerJoin(customers, eq(customers.id, customerNotes.customerId))
    .where(and(eq(customerNotes.id, p.data.noteId), eq(customers.id, p.data.id), eq(customers.businessId, ctx.business.id)));
  if (!row?.path) return new Response("Introuvable", { status: 404 });
  let data: Buffer;
  try {
    data = await readPrivateFile(row.path);
  } catch {
    return new Response("Fichier introuvable sur le serveur.", { status: 404 });
  }
  const download = new URL(req.url).searchParams.has("telecharger");
  const filename = (row.name ?? "document.pdf").replace(/["\\\r\n]/g, "");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
