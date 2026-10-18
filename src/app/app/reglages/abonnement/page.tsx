import type { Metadata } from "next";
import { FeatureStatusPage } from "@/components/feature-status";
import { featureStatus } from "@/server/features";
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businessPlans, promoCodes, users } from "@/db/schema";
import { BillingPanel, ReferralCard } from "@/components/settings/billing-panel";
import { slugify } from "@/lib/slug";
import { referralStatus } from "@/server/actions/billing";
import { activeCampaign, billingEnabled, describePromo } from "@/server/billing";
import { requireContext } from "@/server/context";
import { effectivePlan } from "@/server/plan";

export const metadata: Metadata = { title: "Abonnement · Réglages" };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Merci ! Votre forfait est actif." },
  "non-verifie": { ok: false, text: "Le paiement n'a pas pu être vérifié. Si vous avez été débité, contactez le support : votre forfait sera activé." },
};

/** Code de parrainage personnel, créé à la première visite. */
async function referralCode(userId: string, name: string) {
  const [u] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId));
  if (u?.code) return u.code;
  for (let i = 0; i < 5; i++) {
    const code = `${slugify(name).split("-")[0]?.slice(0, 8).toUpperCase() || "PRO"}${randomBytes(2).toString("hex").toUpperCase()}`;
    const done = await db.update(users).set({ referralCode: code }).where(eq(users.id, userId)).returning({ code: users.referralCode }).catch(() => []);
    if (done.length) return code;
  }
  return "";
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const gate = await featureStatus("subscription");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const ctx = await requireContext();
  const canManage = ctx.can("billing.manage");
  const [current, [row], campaign, [offerRow]] = await Promise.all([
    effectivePlan(ctx.business.id),
    db.select({ interval: businessPlans.interval }).from(businessPlans).where(eq(businessPlans.businessId, ctx.business.id)),
    activeCampaign(),
    db.select().from(promoCodes).where(and(eq(promoCodes.isDefaultOffer, true), eq(promoCodes.isActive, true), sql`(${promoCodes.expiresAt} is null or ${promoCodes.expiresAt} > now())`, sql`(${promoCodes.maxUses} is null or ${promoCodes.usedCount} < ${promoCodes.maxUses})`)).limit(1),
  ]);
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
        canManage={canManage}
        offer={offer}
        enabled={billingEnabled()}
        campaign={campaign ? { endsAt: campaign.endsAt?.toISOString() ?? null, firstPeriodCents: campaign.firstPeriodCents, plan: campaign.plan } : null}
        current={{ plan: current.plan, source: current.source, status: current.status, periodEnd: current.periodEnd?.toISOString() ?? null, cancelAtPeriodEnd: current.cancelAtPeriodEnd, grantedUntil: current.grantedUntil?.toISOString() ?? null, extraSeats: current.extraSeats, customUrlAddon: current.customUrlAddon, interval: row?.interval ?? null }}
      />
      {canManage && ref ? <ReferralCard code={code} link={`${origin}/inscription?ref=${code}`} paying={ref.paying} claimable={ref.claimable} claimed={ref.claimed} invited={invited.map((f) => ({ name: f.name, createdAt: f.createdAt.toISOString(), paying: !!f.paid }))} /> : null}
    </div>
  );
}
