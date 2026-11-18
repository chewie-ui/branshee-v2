import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import { formatNiss } from "@/lib/niss";
import { todayIso } from "@/lib/invoicing";
import { careReportPdf } from "@/server/care-report-pdf";
import { requireContext } from "@/server/context";
import { CARE_SECTIONS, PATHOLOGY_KINDS, currentEntries, episodeOf, logRecordAccess, sessionsDone } from "@/server/physio";

/** Rapport écrit au prescripteur (PDF), pré-rempli depuis le dossier kiné de l'épisode. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
  const ctx = await requireContext("customers.view");
  const { id, episodeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(episodeId)) return new Response("Introuvable", { status: 404 });
  const e = await episodeOf(ctx.business.id, episodeId);
  if (!e || e.customerId !== id) return new Response("Introuvable", { status: 404 });
  const [[c], [b], entries, done] = await Promise.all([
    db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id))),
    db.select().from(businesses).where(eq(businesses.id, ctx.business.id)),
    currentEntries(e.id),
    sessionsDone(e),
  ]);
  if (!c || !b) return new Response("Introuvable", { status: 404 });
  let niss: string | null = null;
  try {
    niss = c.nissEnc ? formatNiss(decrypt(c.nissEnc)) : null;
  } catch {
    niss = null;
  }
  // Le rapport reprend ce qui intéresse le prescripteur : diagnostic, examen, traitement, évolution, clôture.
  const wanted = ["diagnostic", "examen", "plan", "evaluation", "cloture"] as const;
  const sections = wanted.map((k) => ({ label: CARE_SECTIONS.find((x) => x.key === k)!.label, items: entries.filter((x) => x.section === k).map((x) => ({ date: CARE_SECTIONS.find((y) => y.key === k)!.multi ? x.date : null, text: x.content })) }));
  const buf = await careReportPdf({
    practice: { name: b.name, author: ctx.user.name, address: [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), phone: b.phone, email: b.email },
    patient: { name: c.fullName, niss, birthDate: c.birthDate, mutuality: c.mutuality },
    episode: { title: e.title, prescriber: e.prescriberName, prescriberInami: e.prescriberInami, prescriptionDate: e.prescriptionDate, kind: PATHOLOGY_KINDS.find((k) => k.key === e.pathologyKind)?.label ?? e.pathologyKind, sessionsDone: done, sessionsPrescribed: e.sessionsPrescribed, closed: e.status === "closed" },
    sections,
    date: todayIso(ctx.business.timezone),
  });
  await logRecordAccess(ctx, c.id, "print", `Rapport au prescripteur : ${e.title}`);
  const name = `Rapport kiné ${c.fullName} ${todayIso(ctx.business.timezone)}.pdf`.replace(/[^\p{L}\p{N} ._-]/gu, "");
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store" } });
}
