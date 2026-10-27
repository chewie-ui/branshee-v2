import "server-only";
import { clientWord } from "@/lib/terminology";
import { settingsMissing } from "@/lib/invoicing";
import type { AppContext } from "@/server/context";
import { catalog, customerOptions, getSellerSettings } from "@/server/invoicing";

/** Données communes à l'éditeur (nouveau document ou modification). */
export async function editorProps(ctx: AppContext) {
  const [seller, customers, cat] = await Promise.all([getSellerSettings(ctx.business.id), customerOptions(ctx.business.id), catalog(ctx.business.id)]);
  const { saved, ...sellerFields } = seller;
  return {
    seller: sellerFields,
    missing: saved ? settingsMissing(seller) : settingsMissing(seller).length ? settingsMissing(seller) : ["vos informations de facturation"],
    customers,
    catalog: [...cat.services, ...cat.products],
    clientWord: clientWord(ctx.business.businessType),
  };
}
