import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShopSettingsForm } from "@/components/shop/shop-settings";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { shopRights, shopSettingsOf, stripeDestination } from "@/server/shop";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoiceSettings } from "@/db/schema";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Réglages de la boutique");

export default async function ShopSettingsPage() {
  const t = await appT();
  const ctx = await requireContext();
  if (!shopRights(ctx).manage) redirect("/app/boutique");
  const [s, dest, [legal]] = await Promise.all([shopSettingsOf(ctx.business.id), stripeDestination(ctx.business.id), db.select({ name: invoiceSettings.legalName, street: invoiceSettings.street, bce: invoiceSettings.bce, email: invoiceSettings.email }).from(invoiceSettings).where(eq(invoiceSettings.businessId, ctx.business.id))]);
  // Vendre en ligne impose d'afficher l'identité du vendeur (Code de droit économique) : nom, adresse, numéro d'entreprise, email.
  const missing = !legal?.name || !legal.street || !legal.bce || !legal.email;
  const e = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  return (
    <>
      <PageHeader title={t("Réglages de la boutique")} description={t("Retrait, livraison, moyens de paiement.")} />
      {missing ? (
        <p className="mb-4 max-w-3xl rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          {t("Obligatoire pour vendre en ligne : vos informations légales (nom de l'entreprise, adresse, numéro d'entreprise, email) apparaissent sur la boutique et dans ses conditions de vente.")}{" "}
          <Link href="/app/factures/reglages" className="font-medium underline underline-offset-2">{t("Les compléter")}</Link>
        </p>
      ) : null}
      <ShopSettingsForm stripeReady={!!dest} initial={{ enabled: s.enabled, pickup: s.pickup, pickupNote: s.pickupNote ?? "", delivery: s.delivery, deliveryPrice: e(s.deliveryCents), freeFrom: e(s.freeDeliveryFromCents), deliveryNote: s.deliveryNote ?? "", payOnline: s.payOnline, payOnPickup: s.payOnPickup, payTransfer: s.payTransfer, intro: s.intro ?? "" }} />
    </>
  );
}
