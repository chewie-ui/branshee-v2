import type { Metadata } from "next";
import { FeatureStatusPage } from "@/components/feature-status";
import { featureStatus } from "@/server/features";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businessPlans, promoCodes, users } from "@/db/schema";
import { BillingPanel, ReferralCard } from "@/components/settings/billing-panel";
import { referralStatus } from "@/server/referral-status";
import { activeCampaign, billingEnabled, countBilledUsers, describePromo } from "@/server/billing";
import { requireContext } from "@/server/context";
import { effectivePlan } from "@/server/plan";

import { ensureReferralCode } from "@/server/referral";
import { SkydevBillingPanel } from "@/components/settings/skydev-billing-panel";
import { businessModules } from "@/db/schema";
import { businessBrand } from "@/server/brand";

export const metadata: Metadata = { title: "Abonnement · Réglages" };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Merci ! Votre forfait est actif." },
  "non-verifie": { ok: false, text: "Le paiement n'a pas pu être vérifié. Si vous avez été débité, contactez le support : votre forfait sera activé." },
};

const referralCode = ensureReferralCode;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paiement?: string; bloque?: string }> }) {
  const gate = await featureStatus("subscription");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const ctx = await requireContext();
  const canManage = ctx.can("billing.manage");
  const [current, [row], campaign, [offerRow]] = await Promise.all([
    effectivePlan(ctx.business.id),
    db.select({ interval: businessPlans.interval, lockedCents: businessPlans.lockedPriceCents }).from(businessPlans).where(eq(businessPlans.businessId, ctx.business.id)),
    activeCampaign(),
    db.select().from(promoCodes).where(and(eq(promoCodes.isDefaultOffer, true), eq(promoCodes.isActive, true), sql`(${promoCodes.expiresAt} is null or ${promoCodes.expiresAt} > now())`, sql`(${promoCodes.maxUses} is null or ${promoCodes.usedCount} < ${promoCodes.maxUses})`)).limit(1),
  ]);
  // Offre affichée = celle de la marque de l'établissement (c'est aussi elle qui fixe les prix).
  const brand = businessBrand(ctx.business);
  if (brand === "skydev") {
    const [mods, teamUsers] = await Promise.all([db.select({ key: businessModules.moduleKey }).from(businessModules).where(eq(businessModules.businessId, ctx.business.id)), countBilledUsers(ctx.business.id)]);
    const sp = await searchParams;
    const notice = NOTICES[sp.paiement ?? ""];
    return (
      <div className="space-y-6">
        {sp.bloque && current.source === "free" ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert"><b>Votre essai gratuit est terminé.</b> Votre espace est en lecture seule : choisissez votre abonnement ci-dessous pour continuer à créer et modifier. Toutes vos données sont conservées.{canManage ? null : " Demandez au responsable de l'entreprise de s'abonner."}</p> : null}
        {notice ? <p className={notice.ok ? "rounded-lg bg-success-soft p-3 text-sm text-success" : "rounded-lg bg-warning-soft p-3 text-sm text-warning"} role="status">{notice.ok ? "Merci ! Votre abonnement Skydev est actif." : notice.text}</p> : null}
        <SkydevBillingPanel
          canManage={canManage}
          enabled={billingEnabled("skydev")}
          teamUsers={teamUsers}
          current={{ plan: current.plan, source: current.source, status: current.status, periodEnd: current.periodEnd?.toISOString() ?? null, cancelAtPeriodEnd: current.cancelAtPeriodEnd, grantedUntil: current.grantedUntil?.toISOString() ?? null, isTrial: current.isTrial, extraSeats: current.extraSeats, customUrlAddon: current.customUrlAddon, interval: row?.interval ?? null, modules: mods.map((m) => m.key), billedUsers: current.billedUsers }}
        />
      </div>
    );
  }
  const offer = offerRow ? { code: offerRow.code, label: describePromo(offerRow) } : null;
  const notice = NOTICES[(await searchParams).paiement ?? ""];
  const code = canManage ? await referralCode(ctx.user.id, ctx.user.name) : "";
  const ref = canManage ? await referralStatus(ctx.user.id) : null;
  const invited = canManage ? await db.select({ name: users.fullName, createdAt: users.createdAt, paid: users.referralPaidAt }).from(users).where(eq(users.referredById, ctx.user.id)).orderBy(desc(users.createdAt)).limit(50) : [];
  const origin = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

  return (
    <div className="space-y-6">
      {notice ? <p className={notice.ok ? "rounded-lg bg-success-soft p-3 text-sm text-success" : "rounded-lg bg-warning-soft p-3 text-sm text-warning"} role="status">{notice.text}</p> : null}
      <BillingPanel
        lockedCents={row?.lockedCents ?? null}
        canManage={canManage}
        offer={offer}
        enabled={billingEnabled()}
        campaign={campaign ? { endsAt: campaign.endsAt?.toISOString() ?? null, firstPeriodCents: campaign.firstPeriodCents, plan: campaign.plan } : null}
        current={{ plan: current.plan, source: current.source, status: current.status, periodEnd: current.periodEnd?.toISOString() ?? null, cancelAtPeriodEnd: current.cancelAtPeriodEnd, grantedUntil: current.grantedUntil?.toISOString() ?? null, isTrial: current.isTrial, extraSeats: current.extraSeats, customUrlAddon: current.customUrlAddon, interval: row?.interval ?? null }}
      />
      {canManage && ref ? <ReferralCard code={code} link={`${origin}/inscription?ref=${code}`} paying={ref.paying} claimable={ref.claimable} claimed={ref.claimed} invited={invited.map((f) => ({ name: f.name, createdAt: f.createdAt.toISOString(), paying: !!f.paid }))} /> : null}
    </div>
  );
}
