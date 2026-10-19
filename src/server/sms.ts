import "server-only";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminMessages, processedPayments, smsWallets, subscriptions } from "@/db/schema";
import { hiddenFeatureOn } from "@/server/features";
import { LIMITS, type Plan } from "@/lib/plans";
import { stripe } from "@/server/payments";
import { isStaging } from "@/lib/staging";

/**
 * SMS (Spryng) et WhatsApp (API Cloud de Meta), facturés comme dans l'ancien Branshee :
 * 1) quota inclus du forfait (Pro 10 / Pro+ 30 par mois) ; 2) au-delà, solde prépayé si le pro
 * l'autorise (recharge automatique possible) ; 3) sinon repli email. Jamais d'impayé.
 * Le quota et le solde sont communs aux deux canaux ; seul le prix diffère.
 */
export const SMS_PRICE_CENTS = 30;
export const WHATSAPP_PRICE_CENTS = 5;

export function normalizeMsisdn(phone: string, defaultCc = process.env.SPRYNG_DEFAULT_CC || "32") {
  const p = String(phone || "").replace(/[^\d+]/g, "");
  if (!p) return "";
  if (p.startsWith("+")) return p.slice(1);
  if (p.startsWith("00")) return p.slice(2);
  if (p.startsWith("0")) return defaultCc + p.slice(1);
  return p;
}

export const smsConfigured = () => !!process.env.SPRYNG_API_TOKEN && !isStaging();
export const whatsappConfigured = () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID && !isStaging();

/** Interrupteur global (super-admin) : éteint tant qu'il n'a pas été allumé, comme dans l'ancien Branshee. */
export async function smsFeatureOn() {
  return hiddenFeatureOn("sms_notifications");
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: JSON.stringify(body) });
    if (!res.ok) {
      console.error("[sms] fournisseur :", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (e) {
    console.error("[sms] envoi :", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendSms(to: string, body: string): Promise<string | null> {
  const recipient = normalizeMsisdn(to);
  if (!recipient) return null;
  if (!smsConfigured()) {
    console.info(`[sms:dev] → ${recipient} : ${body}`);
    return null;
  }
  const data = await post(process.env.SPRYNG_ENDPOINT || "https://api.spryngsms.com/v1/messages", { Authorization: `Bearer ${process.env.SPRYNG_API_TOKEN}` }, { encoding: "auto", body, originator: process.env.SPRYNG_ORIGINATOR || "Branshee", recipients: [recipient], route: "business" });
  return data ? String((data.id as string) ?? "sent") : null;
}

/** WhatsApp : uniquement via des modèles validés par Meta (rappel et confirmation de RDV). */
export async function sendWhatsapp(to: string, kind: "reminder" | "confirmation", params: string[]): Promise<string | null> {
  const recipient = normalizeMsisdn(to);
  if (!recipient || !whatsappConfigured()) return null;
  const template = kind === "reminder" ? process.env.WHATSAPP_REMINDER_TEMPLATE || "rdv_rappel" : process.env.WHATSAPP_CONFIRMATION_TEMPLATE || "rdv_confirmation";
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "fr";
  const data = await post(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v22.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    { messaging_product: "whatsapp", to: recipient, type: "template", template: { name: template, language: { code: lang }, components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p.replace(/\s+/g, " ").trim() })) }] : [] } },
  );
  const messages = data?.messages as { id?: string }[] | undefined;
  return data ? (messages?.[0]?.id ?? "sent") : null;
}

const monthKey = () => new Date().toISOString().slice(0, 7);

async function wallet(userId: string) {
  await db.insert(smsWallets).values({ userId }).onConflictDoNothing();
  const [w] = await db.select().from(smsWallets).where(eq(smsWallets.userId, userId));
  return w!;
}

/** Recharge automatique : prélève la carte du pro (client Stripe de son abonnement) et crédite le solde. */
export async function tryAutoRecharge(userId: string) {
  const s = stripe();
  const w = await wallet(userId);
  if (!s || !w.autoRecharge.enabled) return w.balanceCents;
  // Pas plus d'une tentative toutes les 10 minutes (évite les doubles prélèvements et l'acharnement sur une carte refusée).
  const lock = await db
    .update(smsWallets)
    .set({ lastAutoRechargeFailureAt: new Date() })
    .where(and(eq(smsWallets.userId, userId), or(sql`${smsWallets.lastAutoRechargeFailureAt} is null`, lt(smsWallets.lastAutoRechargeFailureAt, new Date(Date.now() - 10 * 60000)))))
    .returning({ id: smsWallets.userId });
  if (!lock.length) return w.balanceCents;
  try {
    const [sub] = await db.select({ customer: subscriptions.stripeCustomerId }).from(subscriptions).where(eq(subscriptions.userId, userId));
    if (!sub?.customer) throw new Error("Aucune carte enregistrée.");
    const customer = await s.customers.retrieve(sub.customer);
    let pm = !("deleted" in customer) ? (customer.invoice_settings?.default_payment_method as string | null) : null;
    if (!pm) pm = (await s.paymentMethods.list({ customer: sub.customer, type: "card" })).data[0]?.id ?? null;
    if (!pm) throw new Error("Aucune carte enregistrée.");
    const amount = w.autoRecharge.amountCents;
    const pi = await s.paymentIntents.create({ amount, currency: "eur", customer: sub.customer, payment_method: pm, off_session: true, confirm: true, description: "Branshee — recharge automatique SMS", metadata: { type: "sms_autorecharge", userId } });
    if (pi.status !== "succeeded") throw new Error(pi.status);
    const [u] = await db.update(smsWallets).set({ balanceCents: sql`${smsWallets.balanceCents} + ${amount}`, lastAutoRechargeFailureAt: null, lowBalanceAlert: null }).where(eq(smsWallets.userId, userId)).returning({ b: smsWallets.balanceCents });
    return u?.b ?? w.balanceCents + amount;
  } catch (e) {
    console.error("[sms] recharge automatique :", e instanceof Error ? e.message : e);
    return w.balanceCents;
  }
}

export async function creditWallet(userId: string, cents: number) {
  await wallet(userId);
  await db.update(smsWallets).set({ balanceCents: sql`${smsWallets.balanceCents} + ${cents}`, lowBalanceAlert: null }).where(eq(smsWallets.userId, userId));
}

/** Alerte « solde bas » (message dans l'espace pro), une fois par niveau jusqu'à la prochaine recharge. */
async function alertLowBalance(userId: string, balance: number, threshold: number, empty: boolean) {
  if (balance >= threshold) return;
  const level = empty ? "warning" : "info";
  const locked = await db
    .update(smsWallets)
    .set({ lowBalanceAlert: level })
    .where(and(eq(smsWallets.userId, userId), empty ? sql`coalesce(${smsWallets.lowBalanceAlert}, '') <> 'warning'` : sql`${smsWallets.lowBalanceAlert} is null`))
    .returning({ id: smsWallets.userId });
  if (!locked.length) return;
  const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  await db.insert(adminMessages).values({
    recipientId: userId,
    type: empty ? "warning" : "info",
    title: empty ? "Solde SMS épuisé" : "Solde SMS bientôt épuisé",
    body: empty ? "Votre solde SMS / WhatsApp est vide : les prochains rappels partent par email en attendant une recharge." : `Il vous reste ${eur(balance)} € de crédit SMS / WhatsApp. Pensez à recharger.`,
    ctaLabel: "Recharger",
    ctaUrl: "/app/reglages/sms",
  });
}

/**
 * Cœur de facturation d'un message payant. `ownerId` = propriétaire de l'établissement (porteur du solde),
 * `plan` = forfait de l'établissement (porteur du quota inclus).
 */
export async function chargeAndSend(ownerId: string, plan: Plan, allowOverage: boolean, priceCents: number, send: () => Promise<string | null>): Promise<{ sent: boolean; mode?: "quota" | "balance"; reason?: string }> {
  const quota = LIMITS.smsIncluded[plan];
  const key = monthKey();
  await wallet(ownerId);
  if (quota > 0) {
    // Place dans le quota réservée atomiquement (deux envois simultanés ne peuvent pas prendre la dernière).
    const reserved = await db
      .update(smsWallets)
      .set({ monthCount: sql`case when ${smsWallets.monthKey} = ${key} then ${smsWallets.monthCount} + 1 else 1 end`, monthKey: key })
      .where(and(eq(smsWallets.userId, ownerId), or(sql`${smsWallets.monthKey} is distinct from ${key}`, lt(smsWallets.monthCount, quota))))
      .returning({ c: smsWallets.monthCount });
    if (reserved.length) {
      if (await send()) return { sent: true, mode: "quota" };
      await db.update(smsWallets).set({ monthCount: sql`greatest(${smsWallets.monthCount} - 1, 0)` }).where(eq(smsWallets.userId, ownerId));
      return { sent: false, reason: "provider_error" };
    }
  }
  if (!allowOverage) return { sent: false, reason: "overage_disabled" };
  const w = await wallet(ownerId);
  if (w.autoRecharge.enabled && w.balanceCents < w.autoRecharge.thresholdCents) await tryAutoRecharge(ownerId);
  const debited = await db.update(smsWallets).set({ balanceCents: sql`${smsWallets.balanceCents} - ${priceCents}` }).where(and(eq(smsWallets.userId, ownerId), gte(smsWallets.balanceCents, priceCents))).returning({ b: smsWallets.balanceCents });
  if (!debited.length) {
    await alertLowBalance(ownerId, w.balanceCents, w.autoRecharge.thresholdCents, true);
    return { sent: false, reason: "no_balance" };
  }
  if (!(await send())) {
    await db.update(smsWallets).set({ balanceCents: sql`${smsWallets.balanceCents} + ${priceCents}` }).where(eq(smsWallets.userId, ownerId));
    return { sent: false, reason: "provider_error" };
  }
  await alertLowBalance(ownerId, debited[0]!.b, w.autoRecharge.thresholdCents, false);
  return { sent: true, mode: "balance" };
}

export async function usageThisMonth(ownerId: string) {
  const w = await wallet(ownerId);
  return { used: w.monthKey === monthKey() ? w.monthCount : 0, balanceCents: w.balanceCents, autoRecharge: w.autoRecharge };
}

/** Recharge payée (Checkout) : crédit une seule fois, que l'on vienne du retour ou du webhook. */
export async function completeSmsTopup(session: { id: string; mode: string | null; payment_status: string; amount_total: number | null; metadata: Record<string, string> | null }) {
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.metadata?.type !== "sms_topup") return false;
  const userId = session.metadata.userId;
  const cents = Number(session.metadata.creditCents || session.amount_total || 0);
  if (!userId || !cents) return false;
  const first = await db.insert(processedPayments).values({ id: session.id, userId, kind: "sms_topup", amountCents: cents }).onConflictDoNothing().returning({ id: processedPayments.id });
  if (!first.length) return true;
  await creditWallet(userId, cents);
  return true;
}
