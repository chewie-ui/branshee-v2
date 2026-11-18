import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { CareRecord, type SectionView } from "@/components/physio/care-record";
import { EpisodeActions } from "@/components/physio/episode-actions";
import { formatDay, zoned } from "@/lib/time";
import { formatNiss } from "@/lib/niss";
import { decrypt } from "@/lib/field-crypto";
import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";
import { CARE_SECTIONS, PATHOLOGY_KINDS, currentEntries, entryHistory, episodeOf, logRecordAccess, sessionsDone } from "@/server/physio";

export const generateMetadata = () => appMetadata("Épisode de soins");

const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default async function EpisodePage({ params }: { params: Promise<{ id: string; episodeId: string }> }) {
  const ctx = await requireContext("records.view");
  const { id, episodeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(episodeId)) notFound();
  const e = await episodeOf(ctx.business.id, episodeId);
  if (!e || e.customerId !== id) notFound();
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)));
  if (!c) notFound();
  await logRecordAccess(ctx, c.id, "view", `Épisode « ${e.title} »`);
  const tz = ctx.business.timezone;
  const canManage = ctx.can("records.manage");
  const canExport = ctx.can("records.export");
  const [entries, done] = await Promise.all([currentEntries(e.id, ctx.user.id), sessionsDone(e)]);
  const stamp = (d: Date) => `${formatDay(d, tz, "d MMM yyyy")} ${format(zoned(d, tz), "HH:mm")}`;
  const histories = await Promise.all(entries.filter((x) => x.versions > 1).map(async (x) => [x.key, await entryHistory(ctx.business.id, x.key)] as const));
  const hist = new Map(histories);
  const sections: SectionView[] = CARE_SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    hint: s.hint,
    multi: s.multi,
    entries: entries.filter((x) => x.section === s.key).map((x) => ({ key: x.key, content: x.content, date: x.date, author: x.author, at: stamp(x.at), confidential: x.confidential, passive: x.passive, versions: (hist.get(x.key) ?? []).map((v) => ({ ...v, at: stamp(v.at) })) })),
  }));
  let niss = "";
  try {
    niss = c.nissEnc ? formatNiss(decrypt(c.nissEnc)) : "";
  } catch {
    niss = "";
  }
  const kind = PATHOLOGY_KINDS.find((k) => k.key === e.pathologyKind)?.label ?? e.pathologyKind;
  const over = e.sessionsPrescribed != null && done > e.sessionsPrescribed;
  const approvalSoon = approvalEndsSoon(e.approvalEnd);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/app/clients/${c.id}?onglet=dossier`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />{c.fullName}</Link>
      {/* Identité du patient visible sur chaque écran du dossier. */}
      <div>
        <p className="text-sm text-muted">{c.fullName}{niss ? ` · NISS ${niss}` : ""}{c.birthDate ? ` · né(e) le ${day(c.birthDate)}` : ""}{c.mutuality ? ` · ${c.mutuality}` : ""}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{e.title}</h1>
        {e.status === "closed" ? <p className="mt-1 text-sm font-medium text-muted">Épisode clôturé{e.closedAt ? ` le ${formatDay(e.closedAt, tz, "d MMMM yyyy")}` : ""}</p> : null}
      </div>
      <Card className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
        <div><p className="text-muted">Séances</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${over ? "text-danger" : ""}`}>{done}{e.sessionsPrescribed != null ? ` / ${e.sessionsPrescribed}` : ""}</p></div>
        <div><p className="text-muted">Situation</p><p className="mt-1 font-medium">{kind}</p>{e.nomenclature ? <p className="text-muted">{e.nomenclature}</p> : null}</div>
        <div><p className="text-muted">Prescription</p><p className="mt-1 font-medium">{day(e.prescriptionDate)}</p><p className="text-muted">{e.prescriberName ?? ""}{e.prescriberInami ? ` · ${e.prescriberInami}` : ""}</p></div>
        <div><p className="text-muted">Accord / notification</p><p className={`mt-1 font-medium ${approvalSoon ? "text-warning" : ""}`}>{e.approvalStart || e.approvalEnd ? `${day(e.approvalStart)} → ${day(e.approvalEnd)}` : "—"}</p></div>
      </Card>
      {over ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">Plus de séances que prescrites : une nouvelle prescription ou une demande de séances supplémentaires est nécessaire.</p> : null}
      <EpisodeActions canExport={canExport} customerId={c.id} episodeId={e.id} closed={e.status === "closed"} canManage={canManage} form={{ title: e.title, prescriberName: e.prescriberName ?? "", prescriberInami: e.prescriberInami ?? "", prescriptionDate: e.prescriptionDate ?? "", sessionsPrescribed: e.sessionsPrescribed != null ? String(e.sessionsPrescribed) : "", pathologyKind: e.pathologyKind, nomenclature: e.nomenclature ?? "", approvalStart: e.approvalStart ?? "", approvalEnd: e.approvalEnd ?? "" }} />
      <CareRecord episodeId={e.id} sections={sections} canManage={canManage} today={format(zoned(new Date(), tz), "yyyy-MM-dd")} />
    </div>
  );
}

/** Accord ou notification qui se termine dans moins de 14 jours (calculé hors rendu). */
function approvalEndsSoon(end: string | null) {
  return end ? new Date(`${end}T23:59:59Z`).getTime() - new Date().getTime() < 14 * 86400e3 : false;
}
