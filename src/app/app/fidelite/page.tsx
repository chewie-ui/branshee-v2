import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { LoyaltyBoard } from "@/components/loyalty/loyalty-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { loyaltyCardsOf, loyaltyOrigin, loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Fidélité");

export default async function LoyaltyPage() {
  const t = await appT();
  const ctx = await requireContext();
  const [s, cards, clients] = await Promise.all([loyaltySettingsOf(ctx.business.id), loyaltyCardsOf(ctx.business.id), db.select({ id: customers.id, name: customers.fullName, email: customers.email, phone: customers.phone }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(5000)]);
  return (
    <>
      <PageHeader title={t("Fidélité")} description={t("Une carte à tampons pour vos clients : un passage, un tampon, et la récompense que vous choisissez au bout.")} />
      <LoyaltyBoard settings={{ goal: s.goal, reward: s.reward, autoAppointment: s.autoAppointment, autoShop: s.autoShop, qrEnabled: s.qrEnabled }} cards={cards.map((c) => ({ ...c, last: c.last?.toISOString() ?? null, url: `${loyaltyOrigin()}/fidelite/${c.token}` }))} clients={clients} canManage={loyaltyRights(ctx).manage} />
    </>
  );
}
