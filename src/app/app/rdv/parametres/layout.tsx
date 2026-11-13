import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { RdvSettingsTabs } from "@/components/settings/rdv-settings-tabs";
import { appT } from "@/server/app-locale";

/** Réglages propres à l'app RDV (Skydev) : règles de réservation, emails aux clients. Le reste est dans les Réglages généraux. */
export default async function RdvSettingsLayout({ children }: { children: ReactNode }) {
  const t = await appT();
  return (
    <>
      <PageHeader title={t("Réglages de RDV")} description={t("Comment vos clients réservent, et les emails qu'ils reçoivent.")} />
      <RdvSettingsTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
