import { redirect } from "next/navigation";
import { ShopDesign } from "@/components/shop/shop-design";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { shopRights, shopSettingsOf } from "@/server/shop";
import { resolveShopTheme } from "@/lib/shop-theme";
import { appMetadata, appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Apparence de la boutique");

export default async function ShopLookPage() {
  const t = await appT();
  const ctx = await requireContext(undefined, { app: "boutique" });
  if (!shopRights(ctx).manage) redirect("/app/boutique");
  const s = await shopSettingsOf(ctx.business.id);
  return (
    <>
      <PageHeader title={t("Apparence de la boutique")} description={s.enabled ? t("Couleurs, police, bannière et mise en page : l'aperçu se met à jour en direct.") : t("Votre boutique est fermée : ouvrez-la dans Réglages de la boutique pour que vos clients la voient. L'aperçu fonctionne déjà.")} />
      <ShopDesign initial={resolveShopTheme(s.theme)} shopUrl={`/boutique/${ctx.business.slug}`} />
    </>
  );
}
