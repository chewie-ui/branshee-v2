import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ShopDeals } from "@/components/shop/shop-deals";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { shopRights, shopSettingsOf } from "@/server/shop";
import { appMetadata, appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Promos et menus");

export default async function ShopDealsPage() {
  const t = await appT();
  const ctx = await requireContext(undefined, { app: "boutique" });
  if (!shopRights(ctx).manage) redirect("/app/boutique");
  const [s, list] = await Promise.all([
    shopSettingsOf(ctx.business.id),
    db.select({ id: products.id, name: products.name, category: products.category, priceCents: products.priceCents }).from(products).where(and(eq(products.businessId, ctx.business.id), eq(products.active, true), eq(products.onlineEnabled, true), eq(products.isModel, false))).orderBy(asc(products.category), asc(products.name)),
  ]);
  const categories = [...new Set(list.map((p) => p.category).filter((c): c is string => !!c))];
  return (
    <>
      <PageHeader title={t("Promos et menus")} description={t("« 1 acheté = 1 offert », « −50 % sur un autre produit », menus à prix fixe : appliqués automatiquement dans le panier de vos clients.")} />
      <ShopDeals initial={s.deals ?? []} products={list} categories={categories} />
    </>
  );
}
