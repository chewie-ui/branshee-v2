import type { Metadata } from "next";
import { StockBoard } from "@/components/stock/stock-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { productsOf, stockRights } from "@/server/stock";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  const ctx = await requireContext();
  const rights = stockRights(ctx);
  const list = await productsOf(ctx.business.id);
  return (
    <>
      <PageHeader title="Stock" description="Vos produits, leurs quantités et les alertes de stock bas." />
      <StockBoard products={rights.manage ? list : list.map((p) => ({ ...p, costCents: null }))} canManage={rights.manage} />
    </>
  );
}
