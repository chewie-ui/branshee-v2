import type { Metadata } from "next";
import { Star } from "lucide-react";
import { and, avg, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, reviewReports, reviews } from "@/db/schema";
import { PageTabs } from "@/components/booking-page/page-tabs";
import { ReportReviewButton } from "@/components/public/reviews";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Avis · Page de réservation" };

export default async function ReviewsPage() {
  const ctx = await requireContext("customization.manage");
  const bid = ctx.business.id;
  const [[stats], list, requests, [page]] = await Promise.all([
    db.select({ n: count(), avg: avg(reviews.rating) }).from(reviews).where(eq(reviews.businessId, bid)),
    db.select().from(reviews).where(eq(reviews.businessId, bid)).orderBy(desc(reviews.createdAt)).limit(200),
    db.select({ reviewId: reviewReports.reviewId, status: reviewReports.status }).from(reviewReports).where(and(eq(reviewReports.businessId, bid), eq(reviewReports.reporterKind, "owner"))),
    db.select({ sections: bookingPageSettings.sections }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, bid)),
  ]);
  const req = new Map(requests.map((r) => [r.reviewId, r.status]));
  const visible = page?.sections.includes("reviews");

  return (
    <>
      <PageHeader title="Page de réservation" description="Les avis laissés par vos clients sur votre page." />
      <PageTabs />
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="flex flex-wrap items-center gap-6 p-5">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{stats?.avg ? Number(stats.avg).toFixed(1).replace(".", ",") : "—"}</p>
            <p className="text-sm text-muted">{stats?.n ?? 0} avis</p>
          </div>
          <p className="flex-1 text-sm text-muted">
            {visible ? "La section « Avis clients » est visible sur votre page." : "La section « Avis clients » est masquée : activez-la dans l'onglet Contenu pour que vos clients puissent laisser un avis."} Seuls les clients avec un compte vérifié peuvent publier un avis. Vous ne pouvez pas supprimer un avis vous-même : demandez sa suppression, l&apos;équipe Branshee tranche.
          </p>
        </Card>
        <Card>
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">Pas encore d&apos;avis.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((r) => (
                <li key={r.id} className="space-y-1 px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{r.authorName}</span>
                    <span className="flex text-warning" aria-label={`${r.rating} sur 5`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />)}
                    </span>
                    <span className="text-muted">{formatDay(r.createdAt, ctx.business.timezone, "d MMM yyyy")}</span>
                    {req.get(r.id) === "pending" ? <Badge tone="warning">Suppression demandée</Badge> : req.get(r.id) === "rejected" ? <Badge>Demande refusée</Badge> : null}
                  </div>
                  {r.comment ? <p className="text-muted">{r.comment}</p> : null}
                  {!req.has(r.id) ? <ReportReviewButton reviewId={r.id} action="owner" /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
