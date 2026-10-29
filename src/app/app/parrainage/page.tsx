import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import AccessDeniedPage from "../acces-refuse/page";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralPanel } from "@/components/referral/referral-panel";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { effectivePlan } from "@/server/plan";
import { ensureReferralCode } from "@/server/referral";
import { referralStatus } from "@/server/referral-status";

export const metadata: Metadata = { title: "Parrainage" };

export default async function ReferralPage() {
  const ctx = await requireContext();
  if (!ctx.can("billing.manage")) return <AccessDeniedPage />;
  const brand = await currentBrand();
  const [code, st, invited, plan] = await Promise.all([
    ensureReferralCode(ctx.user.id, ctx.user.name),
    referralStatus(ctx.user.id),
    db.select({ name: users.fullName, createdAt: users.createdAt, paid: users.referralPaidAt }).from(users).where(eq(users.referredById, ctx.user.id)).orderBy(desc(users.createdAt)).limit(100),
    effectivePlan(ctx.business.id),
  ]);
  const base = (brand.id === "skydev" ? (process.env.SKYDEV_APP_URL ?? "https://skydev.be") : (process.env.APP_URL ?? "https://branshee.com")).replace(/\/$/, "");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Parrainage" description={`Invitez des pros sur ${brand.name}, gagnez des mois gratuits.`} />
      <ReferralPanel
        brand={brand.name}
        code={code}
        link={`${base}/inscription?ref=${code}`}
        paying={st.paying}
        claimable={st.claimable}
        claimed={st.claimed}
        canClaim={(plan.source === "stripe" || plan.source === "account") && !ctx.impersonating}
        invited={invited.map((f) => ({ name: f.name, createdAt: f.createdAt.toISOString(), paying: !!f.paid }))}
      />
    </div>
  );
}
