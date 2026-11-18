import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, desc, eq, ne } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/db";
import { careInbox, customers } from "@/db/schema";
import { InboxList } from "@/components/physio/inbox-list";
import { PageHeader } from "@/components/ui/page-header";
import { decrypt } from "@/lib/field-crypto";
import { formatNiss } from "@/lib/niss";
import { formatDay, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";
import { inboxMatch } from "@/server/care-inbox";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Boîte de réception");

const safe = (v: string | null) => {
  try {
    return decrypt(v) ?? "";
  } catch {
    return "";
  }
};

/** Documents reçus en attente d'intégration au dossier d'un patient. */
export default async function InboxPage() {
  const ctx = await requireContext("records.view", { app: "clients" });
  const tz = ctx.business.timezone;
  const stamp = (d: Date) => `${formatDay(d, tz, "d MMM yyyy")} ${format(zoned(d, tz), "HH:mm")}`;
  const [items, handled] = await Promise.all([
    db.select().from(careInbox).where(and(eq(careInbox.businessId, ctx.business.id), eq(careInbox.status, "pending"))).orderBy(desc(careInbox.createdAt)).limit(200),
    db.select({ i: careInbox, name: customers.fullName }).from(careInbox).leftJoin(customers, eq(customers.id, careInbox.customerId)).where(and(eq(careInbox.businessId, ctx.business.id), ne(careInbox.status, "pending"))).orderBy(desc(careInbox.handledAt)).limit(30),
  ]);
  const rows = await Promise.all(
    items.map(async (i) => {
      const m = await inboxMatch(ctx.business.id, i);
      const niss = safe(i.patientNissEnc);
      return {
        id: i.id, title: i.title, source: i.source, sender: [i.senderName, i.senderInami ? `INAMI ${i.senderInami}` : null].filter(Boolean).join(" · "), date: i.docDate ? i.docDate.split("-").reverse().join("/") : null, received: stamp(i.createdAt),
        patient: i.patientName ? `${i.patientName}${i.patientBirthDate ? `, né(e) le ${i.patientBirthDate.split("-").reverse().join("/")}` : ""}${niss ? ` · NISS ${formatNiss(niss)}` : ""}` : null,
        canCreate: !!i.patientName && !m.byNiss, hasFile: !!i.filePath, excerpt: safe(i.contentEnc).slice(0, 280),
        suggested: m.suggested ? { id: m.suggested.id, name: m.suggested.fullName, byNiss: m.byNiss } : null, conflicts: m.conflicts,
      };
    }),
  );
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Patients</Link>
      <PageHeader title="Boîte de réception" description="Rapports et messages reçus d'autres soignants (PDF ou Kmehr). Vérifiez le patient, puis intégrez le document à son dossier." />
      <InboxList items={rows} canManage={ctx.can("records.manage")} handled={handled.map(({ i, name }) => ({ id: i.id, title: i.title, status: i.status, patient: name, by: i.handledByName ?? "", at: i.handledAt ? stamp(i.handledAt) : "" }))} />
    </div>
  );
}
