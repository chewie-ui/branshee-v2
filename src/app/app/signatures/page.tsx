import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { quoteSignatures, salesDocuments } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Signatures" };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Toutes les demandes de signature : en attente, ouvertes, signées, refusées. */
export default async function SignaturesPage() {
  const ctx = await requireContext("invoices.view");
  const rows = await db
    .select({ s: quoteSignatures, number: salesDocuments.number, total: salesDocuments.ttcCents, client: salesDocuments.client })
    .from(quoteSignatures)
    .innerJoin(salesDocuments, eq(salesDocuments.id, quoteSignatures.documentId))
    .where(and(eq(quoteSignatures.businessId, ctx.business.id), isNull(quoteSignatures.cancelledAt)))
    .orderBy(desc(quoteSignatures.sentAt))
    .limit(300);
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", day: "numeric", month: "short" });
  const now = new Date();
  const state = (s: typeof quoteSignatures.$inferSelect) => (s.signedAt ? ["Signé", "bg-success-soft text-success"] : s.declinedAt ? ["Refusé", "bg-danger-soft text-danger"] : s.expiresAt < now ? ["Expiré", "bg-surface-muted text-muted"] : s.viewedAt ? ["Ouvert", "bg-accent-soft text-accent"] : ["Envoyé", "bg-surface-muted text-muted"]);
  return (
    <>
      <PageHeader title="Signatures" description="Vos devis envoyés pour signature en ligne. Pour en envoyer un, ouvrez le devis dans Factures." />
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Aucune demande pour l&apos;instant. Ouvrez un devis dans <Link href="/app/factures/devis" className="font-medium text-accent hover:text-accent-hover">Factures → Devis</Link> puis « Envoyer pour signature ».</Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map(({ s, number, total, client }) => {
              const [label, cls] = state(s);
              return (
                <li key={s.id}>
                  <Link href={`/app/factures/${s.documentId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm hover:bg-surface-muted/60">
                    <span className="w-14 shrink-0 text-muted">{fmt.format(s.sentAt)}</span>
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium tabular-nums">Devis {number}</span><span className="text-muted"> · {String(client?.name ?? s.email)}{s.signerName ? ` · signé par ${s.signerName}` : ""}</span></span>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", cls)}>{label}</span>
                    <span className="w-24 text-right font-medium tabular-nums">{eur(total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
