/**
 * Politique d'annulation (pur, partagé entre le site et le serveur).
 * - « 50 % sous 24 h » (moyenne) : annulation tardive 50 %, absence non excusée 50 %.
 * - « 50 % sous 24 h, 100 % sous 12 h » (stricte) : 50 % puis 100 %, absence non excusée 100 %.
 * Des frais propres à la prestation remplacent ces pourcentages dès que la politique prélève quelque chose.
 */
export type CancellationRule = "free" | "half_24h" | "full_12h";
export type ServiceFee = { type: "amount" | "percent" | null; value: number | null } | null;

export function penaltyRate(rule: CancellationRule, hoursBefore: number) {
  if (hoursBefore < 0) return 0;
  if (rule === "half_24h") return hoursBefore < 24 ? 0.5 : 0;
  if (rule === "full_12h") return hoursBefore < 12 ? 1 : hoursBefore < 24 ? 0.5 : 0;
  return 0;
}

/** Absence non excusée : la moitié (politique moyenne) ou tout (politique stricte). */
export function noShowRate(rule: CancellationRule) {
  return rule === "full_12h" ? 1 : rule === "half_24h" ? 0.5 : 0;
}

/** Montant retenu : frais de la prestation s'ils existent (seulement quand la politique en prélève), sinon le % de la politique. */
export function feeCents(totalCents: number, rate: number, serviceFee: ServiceFee) {
  const fallback = Math.round(totalCents * rate);
  if (fallback <= 0) return 0;
  if (!serviceFee?.type || serviceFee.value == null) return fallback;
  return serviceFee.type === "amount" ? Math.min(totalCents, serviceFee.value) : Math.round(totalCents * (Math.min(100, serviceFee.value) / 100));
}

/** Montants que le client accepte en réservant (affichés dans la case de consentement et conservés). */
export function policyAmounts(rule: CancellationRule, priceCents: number, serviceFee: ServiceFee) {
  if (rule === "free" || priceCents <= 0) return null;
  return {
    rule,
    late24Cents: feeCents(priceCents, 0.5, serviceFee),
    late12Cents: rule === "full_12h" ? feeCents(priceCents, 1, serviceFee) : null,
    noShowCents: feeCents(priceCents, noShowRate(rule), serviceFee),
  };
}
