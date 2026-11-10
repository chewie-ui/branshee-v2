import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogManager } from "@/components/invoicing/catalog-manager";
import { requireContext } from "@/server/context";
import { catalog, getSellerSettings } from "@/server/invoicing";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Catalogue");

export default async function Page() {
  const t = await appT();
  const ctx = await requireContext("invoices.view");
  const [cat, seller] = await Promise.all([catalog(ctx.business.id), getSellerSettings(ctx.business.id)]);
  return (
    <>
      <PageHeader title={t("Catalogue")} description={t("Vos prestations et produits habituels, prêts à ajouter à une facture ou un devis.")} />
      <CatalogManager items={cat.products} services={cat.services} franchise={seller.vatRegime === "franchise"} canManage={ctx.can("invoices.manage")} />
    </>
  );
}
