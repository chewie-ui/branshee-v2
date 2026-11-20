import type { Metadata } from "next";
import { requireSuperadmin } from "@/server/admin";
import { PageHeader } from "@/components/ui/page-header";
import { PersonalizationForm } from "@/components/settings/personalization-form";

export const metadata: Metadata = { title: "Personnalisation" };

/** Thème, couleur, curseur et confort de l'admin (mêmes réglages que dans l'espace pro, pour ce compte). */
export default async function AdminPersonalizationPage() {
  await requireSuperadmin();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Personnalisation" description="Thème, couleur, curseur et confort de lecture. Les mêmes réglages s'appliquent à votre espace pro et à votre espace client." />
      <PersonalizationForm notifications={false} />
    </div>
  );
}
