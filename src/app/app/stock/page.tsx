import type { Metadata } from "next";
import { StockBoard } from "@/components/stock/stock-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { productsOf, stockRights } from "@/server/stock";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Stock");

export default async function StockPage() {
  const t = await appT();
  const ctx = await requireContext();
  const rights = stockRights(ctx);
  const list = await productsOf(ctx.business.id);
  return (
    <>
      <PageHeader title={t("Stock")} description={t("Vos produits, leurs quantités et les alertes de stock bas.")} />
      <StockBoard products={rights.manage ? list : list.map((p) => ({ ...p, costCents: null }))} canManage={rights.manage} />
    </>
  );
}
