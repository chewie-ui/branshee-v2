import type { Metadata } from "next";
import { format } from "date-fns";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { promoCampaigns, promoCodes } from "@/db/schema";
import { CampaignForm, PromoActions, PromoForm } from "@/components/admin/platform";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay, zoned } from "@/lib/time";
import { describePromo } from "@/server/billing";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Codes promo" };
const FOR: Record<string, string> = { pro: "Pro", pro_plus: "Pro+", "pro:month": "Pro mensuel", "pro:year": "Pro annuel", "pro_plus:month": "Pro+ mensuel", "pro_plus:year": "Pro+ annuel" };

export default async function AdminPromos() {
  await requireSuperadmin();
  const [codes, [campaign]] = await Promise.all([db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)), db.select().from(promoCampaigns).limit(1)]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Codes promo" description="Codes saisis par les pros à l'abonnement, offre affichée par défaut, et campagne à compte à rebours." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Campagne" description="Première période à prix cassé pour les nouveaux abonnés, jusqu'à la date de fin." />
          <CampaignForm initial={{ isActive: !!campaign?.isActive, endsAt: campaign?.endsAt ? format(zoned(campaign.endsAt, "Europe/Brussels"), "yyyy-MM-dd'T'HH:mm") : "", firstPeriodEuros: (campaign?.firstPeriodCents ?? 100) / 100, plan: campaign?.plan === "pro_plus" ? "pro_plus" : "pro" }} />
        </Card>
        <Card>
          <CardHeader title="Nouveau code" />
          <PromoForm />
        </Card>
        <Card>
          <CardHeader title={`Codes (${codes.length})`} />
          <ul className="divide-y divide-border">
            {codes.map((c) => {
              const expired = !!c.expiresAt && c.expiresAt < now;
              const full = c.maxUses != null && c.usedCount >= c.maxUses;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1 basis-60">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{c.code}</span>
                      {!c.isActive ? <Badge>Inactif</Badge> : expired ? <Badge tone="warning">Expiré</Badge> : full ? <Badge tone="warning">Épuisé</Badge> : <Badge tone="success">Actif</Badge>}
                      {c.isDefaultOffer ? <Badge tone="accent">Offre affichée</Badge> : null}
                    </span>
                    <span className="block text-sm text-muted">
                      {describePromo(c)} · {c.appliesTo ? FOR[c.appliesTo] ?? c.appliesTo : "tous forfaits"} · {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ""} utilisation{c.usedCount > 1 ? "s" : ""}
                      {c.expiresAt ? ` · jusqu'au ${formatDay(c.expiresAt, "Europe/Brussels", "d MMM yyyy")}` : ""}
                    </span>
                  </span>
                  <PromoActions id={c.id} active={c.isActive} offer={c.isDefaultOffer} />
                </li>
              );
            })}
            {codes.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun code.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}
