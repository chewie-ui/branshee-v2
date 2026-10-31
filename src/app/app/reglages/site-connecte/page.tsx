import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, webhooks } from "@/db/schema";
import { ConnectPanel } from "@/components/connect/connect-panel";
import { currentBrand } from "@/server/brand";
import { deliveriesOf } from "@/server/connect";
import { requireContext } from "@/server/context";
import { shopOrigin, shopSettingsOf } from "@/server/shop";

export const metadata: Metadata = { title: "Connecter un site" };
export const dynamic = "force-dynamic";

/** Relier le site du pro à Skydev : widgets à copier-coller (tout site), clés API et webhooks (site sur mesure). */
export default async function ConnectSitePage() {
  const ctx = await requireContext("settings.manage");
  if ((await currentBrand()).id !== "skydev") redirect("/app/reglages");
  const [keys, hooks, shop] = await Promise.all([
    db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, scopes: apiKeys.scopes, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.businessId, ctx.business.id)).orderBy(desc(apiKeys.createdAt)),
    db.select({ id: webhooks.id, url: webhooks.url, events: webhooks.events, lastStatus: webhooks.lastStatus, lastError: webhooks.lastError, lastAt: webhooks.lastAt }).from(webhooks).where(eq(webhooks.businessId, ctx.business.id)).orderBy(desc(webhooks.createdAt)),
    shopSettingsOf(ctx.business.id),
  ]);
  const deliveries = await deliveriesOf(ctx.business.id, hooks.map((h) => h.id));
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return (
    <ConnectPanel
      origin={shopOrigin()}
      slug={ctx.business.slug}
      shopEnabled={shop.enabled}
      keys={keys.map((k) => ({ ...k, lastUsedAt: iso(k.lastUsedAt), revokedAt: iso(k.revokedAt), createdAt: k.createdAt.toISOString() }))}
      hooks={hooks.map((h) => ({ ...h, lastAt: iso(h.lastAt) }))}
      deliveries={deliveries.map((d) => ({ id: d.id, webhookId: d.webhookId, event: d.event, status: d.status, attempts: d.attempts, lastError: d.lastError, createdAt: d.createdAt.toISOString() }))}
      timezone={ctx.business.timezone || "Europe/Brussels"}
    />
  );
}
