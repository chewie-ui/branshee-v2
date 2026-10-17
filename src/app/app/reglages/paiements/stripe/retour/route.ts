import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { requireContext } from "@/server/context";
import { stripe } from "@/server/payments";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/** Retour de Stripe : on vérifie sur Stripe si le formulaire est complet (jamais d'après l'URL). */
export async function GET() {
  const ctx = await requireContext("billing.manage");
  const s = stripe();
  const [ps] = await db.select().from(paymentSettings).where(eq(paymentSettings.businessId, ctx.business.id));
  if (!s || !ps?.stripeAccountId) return NextResponse.redirect(`${appUrl()}/app/reglages/paiements?stripe=erreur`);
  try {
    const acc = await s.accounts.retrieve(ps.stripeAccountId);
    const done = !!acc.details_submitted;
    await db.update(paymentSettings).set({ stripeStatus: done ? "active" : "pending", stripeAccountEmail: acc.email ?? ps.stripeAccountEmail }).where(eq(paymentSettings.businessId, ctx.business.id));
    return NextResponse.redirect(`${appUrl()}/app/reglages/paiements?stripe=${done ? "ok" : "incomplet"}`);
  } catch {
    return NextResponse.redirect(`${appUrl()}/app/reglages/paiements?stripe=erreur`);
  }
}
