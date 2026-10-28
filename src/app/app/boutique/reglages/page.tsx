import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShopSettingsForm } from "@/components/shop/shop-settings";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { shopRights, shopSettingsOf, stripeDestination } from "@/server/shop";

export const metadata: Metadata = { title: "Réglages de la boutique" };

export default async function ShopSettingsPage() {
  const ctx = await requireContext();
  if (!shopRights(ctx).manage) redirect("/app/boutique");
  const [s, dest] = await Promise.all([shopSettingsOf(ctx.business.id), stripeDestination(ctx.business.id)]);
  const e = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  return (
    <>
      <PageHeader title="Réglages de la boutique" description="Retrait, livraison, moyens de paiement." />
      <ShopSettingsForm stripeReady={!!dest} initial={{ enabled: s.enabled, pickup: s.pickup, pickupNote: s.pickupNote ?? "", delivery: s.delivery, deliveryPrice: e(s.deliveryCents), freeFrom: e(s.freeDeliveryFromCents), deliveryNote: s.deliveryNote ?? "", payOnline: s.payOnline, payOnPickup: s.payOnPickup, payTransfer: s.payTransfer, intro: s.intro ?? "" }} />
    </>
  );
}
