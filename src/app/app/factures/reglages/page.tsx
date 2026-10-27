import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceSettingsForm } from "@/components/invoicing/settings-form";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";

export const metadata: Metadata = { title: "Réglages de facturation" };

export default async function Page() {
  const ctx = await requireContext("invoices.view");
  const { saved, ...settings } = await getSellerSettings(ctx.business.id);
  return (
    <>
      <PageHeader title="Réglages de facturation" description="Ce qui apparaît sur vos factures et devis." />
      <InvoiceSettingsForm initial={settings} saved={saved} canManage={ctx.can("invoices.manage")} />
    </>
  );
}
