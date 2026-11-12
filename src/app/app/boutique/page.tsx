import type { Metadata } from "next";
import Link from "next/link";
import { ShopOrders } from "@/components/shop/shop-orders";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { pickupCode, shopOrdersOf, shopOrigin, shopRights, shopSettingsOf } from "@/server/shop";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Boutique");

export default async function ShopPage() {
  const t = await appT();
  const ctx = await requireContext();
  const [s, orders] = await Promise.all([shopSettingsOf(ctx.business.id), shopOrdersOf(ctx.business.id)]);
  const url = `${shopOrigin()}/boutique/${ctx.business.slug}`;
  return (
    <>
      <PageHeader title={t("Boutique")} description={t("Vos produits en vente en ligne : commandes, retrait ou livraison, paiement en ligne ou sur place.")} />
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.enabled ? "bg-success-soft text-success" : "bg-surface-muted text-muted"}`}>{s.enabled ? "Ouverte" : "Fermée"}</span>
        {s.enabled ? <a href={url} target="_blank" rel="noopener" className="min-w-0 truncate text-sm font-medium text-accent hover:text-accent-hover">{url.replace(/^https?:\/\//, "")}</a> : <p className="text-sm text-muted">{t("Activez la boutique dans les réglages, puis cochez « En vente sur la boutique » sur vos produits (app Stock).")}</p>}
        {shopRights(ctx).manage ? <Link href="/app/boutique/reglages" className="ml-auto inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted">{t("Réglages")}</Link> : null}
      </Card>
      <ShopOrders canManage={shopRights(ctx).manage} tz={ctx.business.timezone || "Europe/Brussels"} orders={orders.map((o) => ({ id: o.id, number: o.number, status: o.status, payMethod: o.payMethod, paid: !!o.paidAt, fulfilment: o.fulfilment, code: o.fulfilment === "pickup" ? pickupCode(o.token) : null, name: o.name, email: o.email, phone: o.phone, address: o.address, note: o.note, lines: o.lines, total: o.totalCents, delivery: o.deliveryCents, createdAt: o.createdAt.toISOString() }))} />
    </>
  );
}
