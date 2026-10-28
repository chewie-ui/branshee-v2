import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { LoyaltyBoard } from "@/components/loyalty/loyalty-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { loyaltyCardsOf, loyaltyOrigin, loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";

export const metadata: Metadata = { title: "Fidélité" };

export default async function LoyaltyPage() {
  const ctx = await requireContext();
  const [s, cards, clients] = await Promise.all([loyaltySettingsOf(ctx.business.id), loyaltyCardsOf(ctx.business.id), db.select({ id: customers.id, name: customers.fullName, email: customers.email, phone: customers.phone }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(5000)]);
  return (
    <>
      <PageHeader title="Fidélité" description="Une carte à tampons pour vos clients : un passage, un tampon, et une récompense au bout." />
      <LoyaltyBoard settings={{ goal: s.goal, reward: s.reward }} cards={cards.map((c) => ({ ...c, last: c.last?.toISOString() ?? null, url: `${loyaltyOrigin()}/fidelite/${c.token}` }))} clients={clients} canManage={loyaltyRights(ctx).manage} />
    </>
  );
}
