import type { Metadata } from "next";
import { GiftCardsBoard } from "@/components/loyalty/gift-cards-board";
import { PageHeader } from "@/components/ui/page-header";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { giftCardsOf, loyaltyRights } from "@/server/loyalty";

export const metadata: Metadata = { title: "Cartes cadeaux" };

export default async function GiftCardsPage() {
  const ctx = await requireContext();
  const rows = await giftCardsOf(ctx.business.id);
  return (
    <>
      <PageHeader title="Cartes cadeaux" description="Vendez des cartes cadeaux et utilisez-les en plusieurs fois." />
      <GiftCardsBoard today={todayIn(ctx.business.timezone)} canManage={loyaltyRights(ctx).manage} rows={rows.map((g) => ({ id: g.id, code: g.code, initial: g.initialCents, balance: g.balanceCents, buyer: g.buyerName, recipient: g.recipientName, expiresOn: g.expiresOn, cancelled: !!g.cancelledAt, createdAt: g.createdAt.toISOString() }))} />
    </>
  );
}
