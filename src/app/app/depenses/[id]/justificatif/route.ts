import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { requireContext } from "@/server/context";
import { readPrivateFile } from "@/server/storage";

/** Justificatif d'une dépense (déchiffré à la volée), réservé à qui voit les finances de l'établissement. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("invoices.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const [e] = await db.select({ ref: expenses.proofRef, name: expenses.proofName, type: expenses.proofType }).from(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.business.id)));
  if (!e?.ref) return new Response("Introuvable", { status: 404 });
  const data = await readPrivateFile(e.ref).catch(() => null);
  if (!data) return new Response("Introuvable", { status: 404 });
  const type = e.type === "application/pdf" || e.type?.startsWith("image/") ? e.type : "application/octet-stream";
  const name = (e.name ?? "justificatif").replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Content-Disposition": `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(e.name ?? "justificatif")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
