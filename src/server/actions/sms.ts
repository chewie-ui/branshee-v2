"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, businesses, notificationSettings, smsWallets } from "@/db/schema";
import { META, getOrCreateCustomer, vatRate } from "@/server/billing";
import { requireContext } from "@/server/context";
import { stripe } from "@/server/payments";
import { invoiceFooter } from "@/lib/legal";

type Result = { ok: true; message?: string; url?: string } | { ok: false; error: string };
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

export async function saveSmsSettings(input: { smsReminders: boolean; smsConfirmations: boolean; smsAllowOverage: boolean; whatsappReminders: boolean; whatsappConfirmations: boolean }): Promise<Result> {
  const ctx = await requireContext("settings.manage", { write: true });
  const v = z.object({ smsReminders: z.boolean(), smsConfirmations: z.boolean(), smsAllowOverage: z.boolean(), whatsappReminders: z.boolean(), whatsappConfirmations: z.boolean() }).safeParse(input);
  if (!v.success) return { ok: false, error: "Réglages invalides." };
  await db.update(notificationSettings).set(v.data).where(eq(notificationSettings.businessId, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "settings.sms", description: "Réglages SMS / WhatsApp modifiés" });
  revalidatePath("/app/reglages/sms");
  return { ok: true, message: "Réglages enregistrés." };
}

/** Le solde appartient au propriétaire de l'établissement (comme l'ancien). */
async function ownerOf(ctx: Awaited<ReturnType<typeof requireContext>>) {
  const [b] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, ctx.business.id));
  return b!.ownerId;
}

export async function topUpSms(amountEuros: number): Promise<Result> {
  const ctx = await requireContext("billing.manage", { write: true });
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const amount = z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)]).safeParse(amountEuros);
  if (!amount.success) return { ok: false, error: "Montant invalide." };
  const s = stripe();
  if (!s) return { ok: false, error: "Paiement non configuré." };
  const owner = await ownerOf(ctx);
  if (owner !== ctx.user.id) return { ok: false, error: "Seul le propriétaire de l'établissement peut recharger le solde." };
  const customer = await getOrCreateCustomer({ id: ctx.user.id, email: ctx.user.email, fullName: ctx.user.name });
  const cents = amount.data * 100;
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ price_data: { currency: "eur", unit_amount: cents, product_data: { name: `Crédit SMS / WhatsApp — ${amount.data} €` } }, quantity: 1, tax_rates: [await vatRate()] }],
    // La carte est gardée pour la recharge automatique.
    payment_intent_data: { setup_future_usage: "off_session", metadata: { type: META.smsType(), [META.user()]: ctx.user.id } },
    metadata: { type: META.smsType(), [META.user()]: ctx.user.id, creditCents: String(cents) },
    success_url: `${appUrl()}/app/reglages/sms/retour?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/app/reglages/sms`,
    locale: "fr",
    // Facture Stripe numérotée (comme pour les abonnements), envoyée au pro avec ses coordonnées de facturation.
    invoice_creation: { enabled: true, invoice_data: { description: process.env.FORCE_BRAND === "skydev" ? "Crédit SMS / WhatsApp Skydev" : "Crédit SMS / WhatsApp Branshee", footer: invoiceFooter, metadata: { type: META.smsType(), [META.user()]: ctx.user.id } } },
    // Mentions légales : nom, adresse complète et n° de TVA (entreprises) repris sur la facture.
    custom_text: { submit: { message: "Indiquez le nom et l'adresse complète à mettre sur la facture. Si vous êtes une entreprise assujettie à la TVA, cochez « J'achète en tant qu'entreprise » et ajoutez votre numéro de TVA. En payant, vous acceptez les conditions d'utilisation de Branshee (branshee.com/conditions-utilisation)." } },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
  });
  return { ok: true, url: session.url! };
}

export async function saveAutoRecharge(input: { enabled: boolean; thresholdCents: number; amountCents: number }): Promise<Result> {
  const ctx = await requireContext("billing.manage", { write: true });
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const v = z.object({ enabled: z.boolean(), thresholdCents: z.number().int().min(100).max(10000), amountCents: z.union([z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)]) }).safeParse(input);
  if (!v.success) return { ok: false, error: "Réglages invalides." };
  const owner = await ownerOf(ctx);
  // Prélèvements automatiques sur la carte du propriétaire : lui seul peut les activer.
  if (owner !== ctx.user.id) return { ok: false, error: "Seul le propriétaire de l'établissement peut régler la recharge automatique." };
  await db.insert(smsWallets).values({ userId: owner, autoRecharge: v.data }).onConflictDoUpdate({ target: smsWallets.userId, set: { autoRecharge: v.data } });
  revalidatePath("/app/reglages/sms");
  return { ok: true, message: v.data.enabled ? "Recharge automatique activée." : "Recharge automatique désactivée." };
}
