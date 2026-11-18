import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, members } from "@/db/schema";
import { todayIso } from "@/lib/invoicing";
import { careDocumentPdf } from "@/server/care-document-pdf";
import { documentContent, documentVersions } from "@/server/care-documents";
import { requireContext } from "@/server/context";
import { logRecordAccess } from "@/server/physio";

/** PDF d'un document INAMI (dernière version, ou ?v=N). Un brouillon sort avec la mention « BROUILLON ». */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docKey: string }> }) {
  const ctx = await requireContext("records.export");
  const { id, docKey } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(docKey)) return new Response("Introuvable", { status: 404 });
  const versions = await documentVersions(ctx.business.id, docKey);
  const want = Number(new URL(req.url).searchParams.get("v")) || null;
  const d = want ? versions.find((x) => x.version === want) : versions[0];
  if (!d || d.customerId !== id) return new Response("Introuvable", { status: 404 });
  const [b] = await db.select().from(businesses).where(and(eq(businesses.id, ctx.business.id)));
  if (!b) return new Response("Introuvable", { status: 404 });
  const [author] = d.authorUserId ? await db.select({ inami: members.inami }).from(members).where(and(eq(members.userId, d.authorUserId), eq(members.businessId, ctx.business.id))) : [];
  const date = d.validatedAt ? todayIso(ctx.business.timezone, d.validatedAt) : todayIso(ctx.business.timezone);
  const buf = await careDocumentPdf({
    practice: { name: b.name, author: d.authorName || ctx.user.name, inami: author?.inami ?? null, address: [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), phone: b.phone, email: b.email },
    recipient: { name: d.recipientName, inami: d.recipientInami },
    title: d.title,
    content: documentContent(d),
    date,
    version: d.version,
    draft: d.status !== "validated",
  });
  await logRecordAccess(ctx, id, "print", `${d.status === "validated" ? "Impression" : "Aperçu"} : ${d.title} (v${d.version})`);
  const name = `${d.title} v${d.version}.pdf`.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 120);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store" } });
}
