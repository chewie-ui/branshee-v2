import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { LoyaltyProgram } from "@/components/loyalty/loyalty-program";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";
import { resolveShopRule } from "@/lib/loyalty-rules";
import { visibleApps } from "@/server/apps";
import { appMetadata, appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Programme de fidélité");

export default async function LoyaltyProgramPage() {
  const t = await appT();
  const ctx = await requireContext(undefined, { app: "fidelite" });
  if (!loyaltyRights(ctx).manage) redirect("/app/fidelite");
  const [s, list, apps] = await Promise.all([
    loyaltySettingsOf(ctx.business.id),
    db.select({ id: products.id, name: products.name, category: products.category, priceCents: products.priceCents }).from(products).where(and(eq(products.businessId, ctx.business.id), eq(products.active, true), eq(products.isModel, false))).orderBy(asc(products.category), asc(products.name)),
    visibleApps(ctx),
  ]);
  const ids = new Set(apps.map((a) => a.id));
  return (
    <>
      <PageHeader title={t("Programme de fidélité")} description={t("Vous décidez de tout : combien de tampons, ce que le client gagne, et ce qui rapporte des tampons.")} />
      <LoyaltyProgram
        initial={{ goal: s.goal, reward: s.reward, autoAppointment: s.autoAppointment, autoShop: s.autoShop, qrEnabled: s.qrEnabled, shopRule: resolveShopRule(s.shopRule) }}
        products={list}
        categories={[...new Set(list.map((p) => p.category).filter((c): c is string => !!c))]}
        hasShop={ids.has("boutique")}
        hasRdv={ids.has("rdv")}
      />
    </>
  );
}
