/**
 * Un paiement Stripe (PaymentIntent) ou une carte en garantie (SetupIntent) ne sert qu'à UNE réservation.
 * Clé du verrou pris dans la transaction de réservation : deux envois simultanés du même paiement
 * passent l'un après l'autre, et le second voit que le paiement est déjà utilisé.
 */
export function paymentLockKey(p: { stripePaymentIntentId?: string | null; stripeSetupIntentId?: string | null } | null | undefined): string | null {
  if (p?.stripePaymentIntentId) return `stripe-pay:${p.stripePaymentIntentId}`;
  if (p?.stripeSetupIntentId) return `stripe-pay:${p.stripeSetupIntentId}`;
  return null;
}
