import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceSettingsForm } from "@/components/invoicing/settings-form";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";
import { ReminderSettings } from "@/components/invoicing/reminder-settings";
import { currentBrand } from "@/server/brand";
import { reminderRuleOf } from "@/server/invoice-mailing";

export const metadata: Metadata = { title: "Réglages de facturation" };

export default async function Page() {
  const ctx = await requireContext("invoices.view");
  const { saved, ...settings } = await getSellerSettings(ctx.business.id);
  const rule = (await currentBrand()).id === "skydev" ? await reminderRuleOf(ctx.business.id) : null;
  return (
    <>
      <PageHeader title="Réglages de facturation" description="Ce qui apparaît sur vos factures et devis." />
      <InvoiceSettingsForm initial={settings} saved={saved} canManage={ctx.can("invoices.manage")} />
      {rule ? <ReminderSettings initial={rule} canManage={ctx.can("invoices.manage")} /> : null}
    </>
  );
}
