import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointmentPayments, appointments, paymentSettings, services } from "@/db/schema";

/**
 * Paiements des clients aux pros (Stripe).
 * - Compte Stripe Connect actif → paiement « destination » : l'argent va directement au pro.
 * - Sinon → encaissé par Branshee, reversé au pro selon son moyen de reversement (comme l'ancien).
 * Politique d'annulation : gratuite / 50 % sous 24 h / 50 % sous 24 h et 100 % sous 12 h,
 * remplacée par les frais propres à la prestation quand il y en a.
 */

let client: Stripe | null | undefined;
export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  // STRIPE_API_BASE : uniquement pour les tests locaux (faux serveur Stripe), jamais défini en production.
  const base = process.env.NODE_ENV !== "production" || process.env.STRIPE_API_BASE_ALLOW === "1" ? process.env.STRIPE_API_BASE : undefined;
  const url = base ? new URL(base) : null;
  client = key ? new Stripe(key, url ? { host: url.hostname, port: url.port || undefined, protocol: url.protocol.replace(":", "") as "http" | "https" } : undefined) : null;
  return client;
}
export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export type { CancellationRule } from "@/lib/cancellation";
export { feeCents, penaltyRate } from "@/lib/cancellation";
import { feeCents, noShowRate, penaltyRate, type CancellationRule } from "@/lib/cancellation";

async function context(appointmentId: string) {
  const [row] = await db
    .select({ a: appointments, p: appointmentPayments, rule: paymentSettings.cancellationRule, acct: paymentSettings.stripeAccountId, acctStatus: paymentSettings.stripeStatus, feeType: services.cancellationFeeType, feeValue: services.cancellationFeeValue })
    .from(appointments)
    .innerJoin(appointmentPayments, eq(appointmentPayments.appointmentId, appointments.id))
    .leftJoin(paymentSettings, eq(paymentSettings.businessId, appointments.businessId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(appointments.id, appointmentId));
  return row ?? null;
}

/** Ce que coûterait une annulation maintenant (affiché au client avant qu'il confirme). */
export async function cancellationQuote(appointmentId: string) {
  const row = await context(appointmentId);
  if (!row || !["authorized", "paid"].includes(row.p.status) || row.p.amountCents <= 0) return null;
  const hrs = (row.a.startsAt.getTime() - Date.now()) / 3_600_000;
  const fee = feeCents(row.p.amountCents, penaltyRate((row.rule ?? "free") as CancellationRule, hrs), row.feeType ? { type: row.feeType, value: row.feeValue } : null);
  return { feeCents: fee, totalCents: row.p.amountCents, paid: row.p.status === "paid" };
}

const set = (appointmentId: string, values: Partial<typeof appointmentPayments.$inferInsert>) => db.update(appointmentPayments).set(values).where(eq(appointmentPayments.appointmentId, appointmentId));

async function chargeCard(row: NonNullable<Awaited<ReturnType<typeof context>>>, cents: number, description: string) {
  const s = stripe();
  const p = row.p;
  if (!s || !p.stripeCustomerId || !p.stripePaymentMethodId) throw new Error("Carte enregistrée introuvable.");
  const destination = row.acctStatus === "active" && row.acct ? row.acct : null;
  return s.paymentIntents.create({ amount: cents, currency: p.currency, customer: p.stripeCustomerId, payment_method: p.stripePaymentMethodId, off_session: true, confirm: true, description, metadata: { businessId: row.a.businessId, appointmentId: row.a.id }, ...(destination ? { transfer_data: { destination } } : {}) });
}

/**
 * Annulation par le client : carte enregistrée → frais prélevés selon la politique ;
 * déjà payé → remboursement de la part non retenue. Jamais bloquant pour l'annulation elle-même.
 */
export async function applyCustomerCancellation(appointmentId: string) {
  const row = await context(appointmentId);
  if (!row || !["authorized", "paid"].includes(row.p.status)) return;
  const s = stripe();
  const hrs = (row.a.startsAt.getTime() - Date.now()) / 3_600_000;
  const fee = feeCents(row.p.amountCents, penaltyRate((row.rule ?? "free") as CancellationRule, hrs), row.feeType ? { type: row.feeType, value: row.feeValue } : null);
  try {
    if (row.p.status === "authorized") {
      if (fee >= 50 && s) {
        const pi = await chargeCard(row, fee, `Frais d'annulation — ${row.a.serviceName ?? "rendez-vous"}`);
        await set(appointmentId, { status: "penalty", penaltyCents: fee, stripePaymentIntentId: pi.id, paidAt: new Date() });
      } else await set(appointmentId, { status: "none" });
      return;
    }
    if (!s || !row.p.stripePaymentIntentId) return;
    const refund = row.p.amountCents - fee;
    if (fee <= 0 || refund < 50) {
      if (fee <= 0 || refund > 0) {
        await s.refunds.create({ payment_intent: row.p.stripePaymentIntentId, reason: "requested_by_customer" });
        await set(appointmentId, { status: "refunded", keptCents: 0 });
      } else await set(appointmentId, { keptCents: fee });
    } else {
      await s.refunds.create({ payment_intent: row.p.stripePaymentIntentId, amount: refund, reason: "requested_by_customer" });
      await set(appointmentId, { status: "partial", keptCents: fee });
    }
  } catch (e) {
    console.error("[paiements] annulation client :", e);
    if (row.p.status === "authorized") await set(appointmentId, { status: "failed" });
  }
}

/** Annulation par l'établissement : tout est rendu au client. */
export async function applyBusinessCancellation(appointmentId: string) {
  const row = await context(appointmentId);
  if (!row) return;
  try {
    if (row.p.status === "authorized") await set(appointmentId, { status: "none" });
    else if (row.p.status === "paid" && row.p.stripePaymentIntentId && stripe()) {
      await stripe()!.refunds.create({ payment_intent: row.p.stripePaymentIntentId, reason: "requested_by_customer" });
      await set(appointmentId, { status: "refunded", keptCents: 0 });
    }
  } catch (e) {
    console.error("[paiements] annulation établissement :", e);
  }
}

/**
 * Absence : justifiée → rien n'est dû (remboursement) ; non justifiée → selon la politique :
 * 50 % (moyenne) ou 100 % (stricte), ou les frais propres à la prestation. Déjà payé → le reste est remboursé.
 */
export async function applyNoShow(appointmentId: string, justified: boolean): Promise<{ charged: boolean; cents?: number; error?: string }> {
  const row = await context(appointmentId);
  if (!row || !["authorized", "paid"].includes(row.p.status)) return { charged: false };
  const s = stripe();
  try {
    if (justified) {
      if (row.p.status === "authorized") await set(appointmentId, { status: "none" });
      else if (s && row.p.stripePaymentIntentId) {
        await s.refunds.create({ payment_intent: row.p.stripePaymentIntentId, reason: "requested_by_customer" });
        await set(appointmentId, { status: "refunded" });
      }
      return { charged: false };
    }
    const fee = feeCents(row.p.amountCents, noShowRate((row.rule ?? "free") as CancellationRule), row.feeType ? { type: row.feeType, value: row.feeValue } : null);
    if (row.p.status === "paid") {
      // Payé à la réservation : on garde la part due et on rembourse le reste.
      const refund = row.p.amountCents - fee;
      if (s && row.p.stripePaymentIntentId && refund >= 50) {
        await s.refunds.create({ payment_intent: row.p.stripePaymentIntentId, amount: refund, reason: "requested_by_customer" });
        await set(appointmentId, { status: fee > 0 ? "partial" : "refunded", keptCents: fee });
      } else await set(appointmentId, { keptCents: row.p.amountCents });
      return { charged: fee > 0, cents: refund >= 50 ? fee : row.p.amountCents };
    }
    if (fee < 50) return { charged: false, error: "Montant trop faible pour être prélevé." };
    const pi = await chargeCard(row, fee, `Absence non excusée — ${row.a.serviceName ?? "rendez-vous"}`);
    await set(appointmentId, { status: "penalty", penaltyCents: fee, stripePaymentIntentId: pi.id, paidAt: new Date() });
    return { charged: true, cents: fee };
  } catch (e) {
    await set(appointmentId, { status: "failed" });
    return { charged: false, error: e instanceof Error ? e.message : "Échec du prélèvement." };
  }
}

/** Le pro revoit des frais prélevés : rembourser (raison valable) ou garder. */
export async function reviewPenalty(appointmentId: string, decision: "refunded" | "kept"): Promise<{ ok: boolean; error?: string }> {
  const row = await context(appointmentId);
  if (!row || row.p.status !== "penalty") return { ok: false, error: "Aucun frais à revoir." };
  if (decision === "refunded") {
    if (!stripe() || !row.p.stripePaymentIntentId) return { ok: false, error: "Paiement Stripe introuvable." };
    try {
      await stripe()!.refunds.create({ payment_intent: row.p.stripePaymentIntentId, reason: "requested_by_customer" });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Échec du remboursement." };
    }
    await set(appointmentId, { status: "refunded", cancellationDecision: "refunded", cancellationReviewedAt: new Date() });
  } else await set(appointmentId, { cancellationDecision: "kept", cancellationReviewedAt: new Date() });
  return { ok: true };
}
