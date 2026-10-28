import type Stripe from "stripe";
import { completeCheckout, syncSubscription } from "@/server/billing";
import { stripe } from "@/server/payments";
import { completeSmsTopup } from "@/server/sms";
import { cancelShopOrderAndRestock, completeShopPayment } from "@/server/shop";

/**
 * Webhook Stripe (abonnements) : renouvellements, résiliations, échecs de paiement, changements faits
 * depuis le portail. Signature vérifiée avec STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response("Non configuré", { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (event.data.object.mode === "payment") {
          if (event.data.object.metadata?.type === "shop_order") await completeShopPayment(event.data.object);
          else await completeSmsTopup(event.data.object);
        }
        else await completeCheckout(event.data.object);
        break;
      case "checkout.session.expired":
        if (event.data.object.metadata?.type === "shop_order" && event.data.object.metadata.orderId) await cancelShopOrderAndRestock(event.data.object.metadata.orderId);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.payment_failed": {
        const subId = (event.data.object as unknown as { subscription?: string | null; parent?: { subscription_details?: { subscription?: string } } }).subscription ?? (event.data.object as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
        if (subId) await syncSubscription(await s.subscriptions.retrieve(subId));
        break;
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return new Response("Erreur", { status: 500 });
  }
  return Response.json({ received: true });
}
