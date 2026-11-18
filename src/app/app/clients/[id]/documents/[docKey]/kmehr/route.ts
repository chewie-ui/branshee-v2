import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, members } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import { buildKmehrReport } from "@/lib/kmehr";
import { documentContent, documentVersions } from "@/server/care-documents";
import { requireContext } from "@/server/context";
import { logRecordAccess } from "@/server/physio";

/** Document de soins validé au format Kmehr (XML), à joindre à un envoi électronique (eHealthBox). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docKey: string }> }) {
  const ctx = await requireContext("records.export");
  const { id, docKey } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(docKey)) return new Response("Introuvable", { status: 404 });
  const versions = await documentVersions(ctx.business.id, docKey);
  const want = Number(new URL(req.url).searchParams.get("v")) || null;
  const d = want ? versions.find((x) => x.version === want) : versions.find((x) => x.status === "validated");
  if (!d || d.customerId !== id) return new Response("Introuvable", { status: 404 });
  if (d.status !== "validated") return new Response("Validez le document avant de l'exporter en Kmehr.", { status: 409 });
  const [[c], [b], [author]] = await Promise.all([
    db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id))),
    db.select().from(businesses).where(eq(businesses.id, ctx.business.id)),
    d.authorUserId ? db.select({ inami: members.inami, name: members.displayName }).from(members).where(and(eq(members.userId, d.authorUserId), eq(members.businessId, ctx.business.id))) : Promise.resolve([]),
  ]);
  if (!c || !b) return new Response("Introuvable", { status: 404 });
  let niss: string | null = null;
  try {
    niss = c.nissEnc ? decrypt(c.nissEnc) : null;
  } catch {
    niss = null;
  }
  const at = d.validatedAt ?? d.createdAt;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.business.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  const authorName = (author?.name ?? d.authorName).trim();
  const [firstName, ...rest] = authorName.split(/\s+/);
  const xml = buildKmehrReport({
    messageId: `${d.docKey.slice(0, 8)}${d.version}`,
    date: `${p("year")}-${p("month")}-${p("day")}`,
    time: `${p("hour")}:${p("minute")}:${p("second")}`,
    sender: { inami: author?.inami ?? null, firstName: firstName ?? "", lastName: rest.join(" ") || (firstName ?? ""), practice: b.name },
    recipient: { inami: d.recipientInami, name: d.recipientName },
    patient: { niss, firstName: c.firstName ?? "", lastName: c.lastName ?? c.fullName, birthDate: c.birthDate, sex: c.sex },
    title: d.title,
    text: documentContent(d),
    language: c.language ?? "fr",
  });
  await logRecordAccess(ctx, c.id, "export", `Kmehr : ${d.title} (v${d.version})`);
  const name = `${d.title} v${d.version}`.normalize("NFD").replace(/[^\w-]+/g, "-").slice(0, 80);
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.xml"`, "Cache-Control": "private, no-store" } });
}
