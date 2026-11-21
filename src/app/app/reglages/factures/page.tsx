import { Suspense } from "react";
import { BillingInvoices } from "@/components/settings/billing-invoices";
import { PaymentMethods } from "@/components/settings/payment-methods";
import { BillingDetailsForm } from "@/components/settings/billing-details";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { appMetadata, appT } from "@/server/app-locale";
import { billingDetails, listPaymentMethods } from "@/server/billing-methods";
import { businessBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { stripeEnabled } from "@/server/payments";

export const generateMetadata = appMetadata("Factures et cartes · Réglages");

async function Methods() {
  const ctx = await requireContext();
  const { methods } = await listPaymentMethods(ctx);
  return <PaymentMethods methods={methods} canManage={ctx.can("billing.manage") && !ctx.impersonating} enabled={stripeEnabled()} />;
}

async function Details() {
  const ctx = await requireContext();
  const d = await billingDetails(ctx).catch(() => null);
  return <BillingDetailsForm initial={d} canManage={ctx.can("billing.manage") && !ctx.impersonating && stripeEnabled()} />;
}

/** Réglages › Factures et cartes : les factures de l'abonnement et les moyens de paiement, au même endroit. */
export default async function InvoicesPage() {
  const t = await appT();
  const ctx = await requireContext();
  if (!ctx.can("billing.manage")) {
    return <Card className="p-6 text-sm text-muted">{t("Seul le responsable de l'entreprise voit les factures et les moyens de paiement de l'abonnement.")}</Card>;
  }
  const brand = businessBrand(ctx.business) === "skydev" ? "Skydev" : "Branshee";
  return (
    <div className="space-y-6">
      <Suspense fallback={<PageSkeleton />}>
        <BillingInvoices businessId={ctx.business.id} brand={brand} />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <Methods />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <Details />
      </Suspense>
    </div>
  );
}
