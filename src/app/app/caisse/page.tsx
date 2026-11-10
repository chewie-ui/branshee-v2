import type { Metadata } from "next";
import { OpenRegister, PosRegister } from "@/components/pos/pos-register";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { openSessionOf, productsOf, sessionTotals } from "@/server/stock";
import { getSellerSettings } from "@/server/invoicing";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";
import { intlLocale } from "@/lib/i18n/app";

export const generateMetadata = appMetadata("Caisse");
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const t = await appT();
  const ctx = await requireContext();
  const session = await openSessionOf(ctx.business.id);
  if (!session) return (<><PageHeader title={t("Caisse")} description={t("Encaissez au comptoir : espèces ou carte, avec le stock à jour.")} /><OpenRegister /></>);
  const [list, tot, seller] = await Promise.all([productsOf(ctx.business.id, { activeOnly: true }), sessionTotals(ctx.business.id, session.id), getSellerSettings(ctx.business.id)]);
  const since = new Intl.DateTimeFormat(intlLocale(t.locale), { timeZone: ctx.business.timezone || "Europe/Brussels", hour: "2-digit", minute: "2-digit" }).format(session.openedAt);
  return (
    <>
      <h1 className="sr-only">{t("Caisse")}</h1>
      <PosRegister products={list.filter((p) => !p.isModel).map((p) => ({ ...p, costCents: null }))} expectedCash={session.openingCashCents + tot.cash - tot.refundedCash} franchise={seller.vatRegime === "franchise"} sessionInfo={`Ouverte à ${since} · ${tot.tickets} ticket${tot.tickets > 1 ? "s" : ""}`} />
    </>
  );
}
