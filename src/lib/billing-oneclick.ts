/**
 * Paiement en un clic (carte enregistrée) : clé d'idempotence Stripe.
 * Deux envois rapprochés (double clic, deux onglets, réseau qui renvoie) pour le même établissement, la même carte,
 * le même prix et le même nombre d'utilisateurs donnent la même clé : Stripe ne crée qu'UN abonnement
 * (donc un seul prélèvement). La fenêtre est courte pour qu'un nouvel essai, plus tard, reparte de zéro.
 */
export const ONE_CLICK_WINDOW_MS = 2 * 60 * 1000;

export function oneClickIdempotencyKey(input: { businessId: string; paymentMethodId: string; priceId: string; quantity: number; interval: string; promoId?: string | null }, now: number = Date.now()) {
  const bucket = Math.floor(now / ONE_CLICK_WINDOW_MS);
  return ["sky-oneclick", input.businessId, input.paymentMethodId, input.priceId, input.quantity, input.interval, input.promoId ?? "-", bucket].join(":");
}

/** Abonnement créé en un clic réellement actif (payé, ou essai) : sinon, ne pas annoncer « Bienvenue ». */
export const isStartedSubscription = (status: string) => status === "active" || status === "trialing";
