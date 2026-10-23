import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { requireContext } from "@/server/context";
import { stripe } from "@/server/payments";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
const back = (q: string) => NextResponse.redirect(`${appUrl()}/app/reglages/paiements?${q}`);

/** Démarre (ou reprend) l'ouverture d'un compte Stripe Express ; Stripe héberge le formulaire. */
export async function GET() {
  const ctx = await requireContext("billing.manage");
  if (ctx.impersonating) return back("stripe=erreur");
  const s = stripe();
  if (!s) return back("stripe=non_configure");
  const [ps] = await db.select().from(paymentSettings).where(eq(paymentSettings.businessId, ctx.business.id));
  try {
    let accountId = ps?.stripeAccountId;
    if (!accountId || ps?.stripeStatus === "not_connected") {
      const acc = await s.accounts.create({ type: "express", capabilities: { card_payments: { requested: true }, transfers: { requested: true } }, metadata: { businessId: ctx.business.id }, email: ctx.user.email });
      accountId = acc.id;
      await db.update(paymentSettings).set({ stripeAccountId: accountId, stripeStatus: "pending", stripeAccountEmail: ctx.user.email }).where(eq(paymentSettings.businessId, ctx.business.id));
    }
    const link = await s.accountLinks.create({ account: accountId, refresh_url: `${appUrl()}/app/reglages/paiements/stripe/actualiser`, return_url: `${appUrl()}/app/reglages/paiements/stripe/retour`, type: "account_onboarding" });
    return NextResponse.redirect(link.url);
  } catch (e) {
    console.error("[stripe] connexion :", e);
    return back("stripe=erreur");
  }
}
