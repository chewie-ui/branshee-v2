import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, reviewReports } from "@/db/schema";
import { ReportDecision } from "@/components/admin/relations";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Avis signalés" };
const REASONS: Record<string, string> = { insulting: "Insultant", false: "Faux / mensonger", spam: "Spam / publicité", personal: "Données personnelles", other: "Autre" };
const WHO: Record<string, string> = { visitor: "Visiteur", user: "Utilisateur connecté", owner: "Le pro concerné" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requireSuperadmin();
  const status = (await searchParams).statut === "traites" ? "done" : "pending";
  const rows = await db
    .select({ r: reviewReports, business: businesses.name, slug: businesses.slug })
    .from(reviewReports)
    .innerJoin(businesses, eq(businesses.id, reviewReports.businessId))
    .where(status === "pending" ? eq(reviewReports.status, "pending") : undefined)
    .orderBy(desc(reviewReports.createdAt))
    .limit(100);
  const list = status === "done" ? rows.filter((x) => x.r.status !== "pending") : rows;

  return (
    <>
      <PageHeader title="Avis signalés" description="Supprimer l'avis ou le conserver. Tous les signalements d'un même avis sont tranchés ensemble." />
      <nav className="mb-4 flex gap-2 text-sm">
        {[["", "À traiter"], ["traites", "Traités"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/signalements?statut=${v}` : "/admin/signalements"} className={cn("rounded-full border px-3 py-1", (v === "traites") === (status === "done") ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted")}>{l}</Link>
        ))}
      </nav>
      <div className="space-y-3">
        {list.map(({ r, business, slug }) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/${slug}`} target="_blank" className="font-semibold hover:underline">{business}</Link>
              <Badge tone="warning">{REASONS[r.reason]}</Badge>
              <span className="text-muted">par {WHO[r.reporterKind]} · {formatDay(r.createdAt, "Europe/Brussels", "d MMM yyyy")}</span>
              {r.status !== "pending" ? <Badge tone={r.status === "accepted" ? "danger" : "success"}>{r.status === "accepted" ? "Avis supprimé" : "Avis conservé"}</Badge> : null}
              {r.status === "pending" && !r.reviewId ? <Badge>Avis déjà supprimé</Badge> : null}
            </div>
            <blockquote className="mt-3 rounded-lg bg-surface-muted px-4 py-3 text-sm">
              <p className="flex items-center gap-1 font-medium">
                {r.snapshot.authorName}
                <span className="ml-1 inline-flex text-warning" aria-label={`${r.snapshot.rating} sur 5`}>
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3.5", i < r.snapshot.rating && "fill-current")} aria-hidden="true" />)}
                </span>
              </p>
              {r.snapshot.comment ? <p className="mt-1 whitespace-pre-line text-muted">{r.snapshot.comment}</p> : null}
            </blockquote>
            {r.message ? <p className="mt-2 text-sm"><span className="text-muted">Motif détaillé : </span>{r.message}</p> : null}
            {r.decisionNote ? <p className="mt-2 text-sm text-muted">Note : {r.decisionNote}</p> : null}
            {r.status === "pending" ? <ReportDecision id={r.id} /> : null}
          </Card>
        ))}
        {list.length === 0 ? <Card className="p-5 text-sm text-muted">{status === "pending" ? "Aucun signalement à traiter." : "Aucun signalement traité."}</Card> : null}
      </div>
    </>
  );
}
