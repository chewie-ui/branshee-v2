import type { Metadata } from "next";
import { StockBoard } from "@/components/stock/stock-board";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { productsOf, stockRights } from "@/server/stock";
import { visibleApps } from "@/server/apps";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Stock");

export default async function StockPage() {
  const t = await appT();
  const ctx = await requireContext();
  const rights = stockRights(ctx);
  const [list, apps] = await Promise.all([productsOf(ctx.business.id), visibleApps(ctx)]);
  // Raccourci vers la Boutique seulement si elle est utilisée (sur l'accueil et ouverte à ce membre).
  const shop = apps.some((a) => a.id === "boutique" && a.pinned);
  return (
    <>
      <PageHeader
        title={t("Stock")}
        description={t("Vos produits, leurs quantités et les alertes de stock bas.")}
        action={shop ? <Link href="/app/boutique" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted"><ShoppingBag className="size-4" aria-hidden="true" />{t("Boutique en ligne")}</Link> : null}
      />
      <StockBoard products={rights.manage ? list : list.map((p) => ({ ...p, costCents: null }))} canManage={rights.manage} />
    </>
  );
}
