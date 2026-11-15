import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, loyaltyCards } from "@/db/schema";
import { LoyaltyDesign } from "@/components/loyalty/loyalty-design";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";
import { resolveLoyaltyTheme } from "@/lib/loyalty-theme";
import { appMetadata, appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Apparence de la carte");

export default async function LoyaltyLookPage() {
  const t = await appT();
  const ctx = await requireContext(undefined, { app: "fidelite" });
  if (!loyaltyRights(ctx).manage) redirect("/app/fidelite");
  const s = await loyaltySettingsOf(ctx.business.id);
  const [biz] = await db.select({ photoUrl: businesses.photoUrl }).from(businesses).where(eq(businesses.id, ctx.business.id));
  const [card] = await db.select({ token: loyaltyCards.token }).from(loyaltyCards).where(eq(loyaltyCards.businessId, ctx.business.id)).orderBy(desc(loyaltyCards.lastStampAt)).limit(1);
  return (
    <>
      <PageHeader title={t("Apparence de la carte")} description={t("La carte que vos clients gardent sur leur téléphone : à vos couleurs, avec votre logo et votre nom.")} />
      <LoyaltyDesign initial={resolveLoyaltyTheme(s.theme)} business={ctx.business.name} businessLogo={biz?.photoUrl ?? null} goal={s.goal} reward={s.reward} sampleUrl={card ? `/fidelite/${card.token}` : null} />
    </>
  );
}
