import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceSettingsForm } from "@/components/invoicing/settings-form";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";
import { ReminderSettings } from "@/components/invoicing/reminder-settings";
import { currentBrand } from "@/server/brand";
import { reminderRuleOf } from "@/server/invoice-mailing";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Réglages de facturation");

export default async function Page() {
  const t = await appT();
  const ctx = await requireContext("invoices.view");
  const { saved, ...settings } = await getSellerSettings(ctx.business.id);
  const rule = (await currentBrand()).id === "skydev" ? await reminderRuleOf(ctx.business.id) : null;
  return (
    <>
      <PageHeader title={t("Réglages de facturation")} description={t("Ce qui apparaît sur vos factures et devis.")} />
      <InvoiceSettingsForm initial={settings} saved={saved} canManage={ctx.can("invoices.manage")} />
      {rule ? <ReminderSettings initial={rule} canManage={ctx.can("invoices.manage")} /> : null}
    </>
  );
}
