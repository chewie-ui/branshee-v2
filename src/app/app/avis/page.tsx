import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, isNotNull, and } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { ReviewSender } from "@/components/reviews/review-sender";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { recentRequests, reviewRights, reviewSettingsOf, reviewStats } from "@/server/google-reviews";

export const metadata: Metadata = { title: "Avis Google" };
const fdate = (d: Date) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(d);

export default async function ReviewsPage() {
  const ctx = await requireContext();
  const rights = reviewRights(ctx);
  const [s, stats, recent, clients] = await Promise.all([
    reviewSettingsOf(ctx.business.id),
    reviewStats(ctx.business.id),
    ctx.can("customers.view") ? recentRequests(ctx.business.id) : Promise.resolve([]),
    rights.send ? db.select({ id: customers.id, name: customers.fullName, email: customers.email }).from(customers).where(and(eq(customers.businessId, ctx.business.id), isNotNull(customers.email))).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([]),
  ]);
  const rate = stats.sent ? Math.round((stats.clicked / Math.max(1, stats.sent + stats.scans)) * 100) : null;
  return (
    <>
      <PageHeader title="Avis Google" description="Plus d'avis sur Google, sans y penser : une demande après chaque rendez-vous, et un QR code au comptoir." />
      {!s.googleUrl ? (
        <Card className="mb-4 border-warning p-5">
          <p className="font-medium">Première étape : le lien de votre fiche Google</p>
          <p className="mt-1 text-sm text-muted">Sans lui, les demandes ne peuvent pas partir. Il se copie en 30 secondes depuis votre fiche Google.</p>
          {rights.settings ? <Link href="/app/avis/reglages" className="mt-3 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Ajouter le lien</Link> : <p className="mt-2 text-sm text-muted">Demandez au responsable de l&apos;ajouter.</p>}
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-muted">Demandes envoyées</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.sent}</p><p className="text-xs text-muted">90 derniers jours</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Scans du QR code</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.scans}</p><p className="text-xs text-muted">Au comptoir</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Partis vers Google</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.clicked}</p><p className="text-xs text-muted">{rate === null ? "Clics sur « Donner mon avis »" : `${rate} % des demandes`}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Remarques privées</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.feedback}</p><Link href="/app/avis/remarques" className="text-xs font-medium text-accent hover:text-accent-hover">Les lire</Link></Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {rights.send ? <ReviewSender clients={clients.map((c) => ({ id: c.id, label: `${c.name} · ${c.email}` }))} disabled={!s.googleUrl} /> : null}
          <Card className="overflow-hidden">
            <h2 className="border-b border-border px-5 py-3 font-semibold">Dernières demandes</h2>
            {recent.length ? (
              <ul className="divide-y divide-border">
                {recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                    <span className="w-14 shrink-0 text-muted">{fdate(r.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate">{r.name ?? r.email}{r.appointmentId ? <span className="text-muted"> · après RDV</span> : null}</span>
                    <span className={r.googleClickedAt ? "rounded bg-success-soft px-1.5 text-xs font-medium text-success" : r.feedbackAt ? "rounded bg-warning-soft px-1.5 text-xs font-medium text-warning" : "text-xs text-muted"}>{r.googleClickedAt ? "Parti vers Google" : r.feedbackAt ? "Remarque privée" : r.openedAt ? "Ouvert" : "Envoyé"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-6 text-sm text-muted">Aucune demande pour l&apos;instant.{s.autoSend ? " Elles partiront automatiquement après vos prochains rendez-vous." : ""}</p>}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-semibold">Envoi automatique</h2>
          <p className="mt-1 text-sm text-muted">{s.autoSend ? `Activé : une demande part ${s.delayHours} h après chaque rendez-vous terminé, au plus une fois tous les ${s.minDaysBetween} jours par client.` : "Désactivé. Activez-le pour demander un avis après chaque rendez-vous, sans rien faire."}</p>
          {rights.settings ? <Link href="/app/avis/reglages" className="mt-3 inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted">Réglages</Link> : null}
          <h2 className="mt-6 font-semibold">QR code du comptoir</h2>
          <p className="mt-1 text-sm text-muted">Une affiche à poser à l&apos;accueil : vos clients scannent et laissent leur avis.</p>
          <a href="/imprimer/avis" target="_blank" rel="noopener" className="mt-3 inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted">Imprimer l&apos;affiche</a>
          <p className="mt-6 text-xs text-muted">Tous vos clients reçoivent le même lien vers Google : trier les clients pour n&apos;envoyer que les contents est interdit par Google. Ceux qui ont un souci peuvent aussi vous écrire en privé.</p>
        </Card>
      </div>
    </>
  );
}
