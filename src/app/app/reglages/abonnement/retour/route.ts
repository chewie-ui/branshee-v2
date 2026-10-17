import { NextResponse, type NextRequest } from "next/server";
import { completeCheckout } from "@/server/billing";
import { requireContext } from "@/server/context";
import { stripe } from "@/server/payments";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/** Retour de la page de paiement Stripe : le forfait n'est activé qu'après vérification auprès de Stripe. */
export async function GET(req: NextRequest) {
  const ctx = await requireContext("billing.manage");
  const id = req.nextUrl.searchParams.get("session_id") ?? "";
  const s = stripe();
  if (!s || !/^cs_\w+$/.test(id)) return NextResponse.redirect(`${appUrl()}/app/reglages/abonnement?paiement=non-verifie`);
  const session = await s.checkout.sessions.retrieve(id).catch(() => null);
  if (!session || session.metadata?.businessId !== ctx.business.id) return NextResponse.redirect(`${appUrl()}/app/reglages/abonnement?paiement=non-verifie`);
  const done = await completeCheckout(session);
  return NextResponse.redirect(`${appUrl()}/app/reglages/abonnement?paiement=${done ? "ok" : "non-verifie"}`);
}
