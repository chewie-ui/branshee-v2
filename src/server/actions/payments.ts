"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, paymentSettings } from "@/db/schema";
import { requireContext } from "@/server/context";
import { stripe } from "@/server/payments";
import { deletePublicImage, savePublicImage } from "@/server/storage";
import type { SettingsState } from "@/server/actions/settings";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const on = (fd: FormData, k: string) => fd.get(k) === "on";

const schema = z.object({
  prepaymentEnabled: z.boolean(),
  prepaymentRequired: z.boolean(),
  cancellationRule: z.enum(["free", "half_24h", "full_12h"]),
  cash: z.boolean(),
  cardOnSite: z.boolean(),
  bankTransfer: z.object({ enabled: z.boolean(), iban: z.string().max(40).regex(/^[A-Z0-9]*$/, "IBAN invalide."), bic: z.string().max(11).regex(/^[A-Z0-9]*$/, "BIC invalide."), bankName: z.string().max(80), note: z.string().max(300) }),
  paypal: z.object({ enabled: z.boolean(), paypalMe: z.string().max(80).regex(/^[\w.-]*$/, "Identifiant PayPal.me invalide.") }),
  qrNote: z.string().max(300),
  qrEnabled: z.boolean(),
  payout: z.object({ method: z.enum(["", "bank_transfer", "paypal", "cash", "other"]), iban: z.string().max(40), bic: z.string().max(11), paypalEmail: z.union([z.literal(""), z.email({ message: "Email PayPal invalide." })]), other: z.string().max(300) }),
});

export async function savePaymentSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const ctx = await requireContext("billing.manage");
  const parsed = schema.safeParse({
    prepaymentEnabled: on(fd, "prepaymentEnabled"),
    prepaymentRequired: on(fd, "prepaymentRequired"),
    cancellationRule: str(fd, "cancellationRule") || "free",
    cash: on(fd, "cash"),
    cardOnSite: on(fd, "cardOnSite"),
    bankTransfer: { enabled: on(fd, "btEnabled"), iban: str(fd, "iban").replace(/\s/g, "").toUpperCase(), bic: str(fd, "bic").toUpperCase(), bankName: str(fd, "bankName"), note: str(fd, "bankNote") },
    paypal: { enabled: on(fd, "ppEnabled"), paypalMe: str(fd, "paypalMe").replace(/^https?:\/\/(www\.)?paypal\.me\//i, "") },
    qrNote: str(fd, "qrNote"),
    qrEnabled: on(fd, "qrEnabled"),
    payout: { method: str(fd, "payoutMethod") as never, iban: str(fd, "payoutIban").replace(/\s/g, "").toUpperCase(), bic: str(fd, "payoutBic").toUpperCase(), paypalEmail: str(fd, "payoutPaypal").toLowerCase(), other: str(fd, "payoutOther") },
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path.at(-1))] ??= i.message;
    return { error: parsed.error.issues[0]!.message, fieldErrors };
  }
  const v = parsed.data;
  if (v.bankTransfer.enabled && !v.bankTransfer.iban) return { error: "Indiquez l'IBAN pour proposer le virement.", fieldErrors: { iban: "IBAN requis." } };
  if (v.paypal.enabled && !v.paypal.paypalMe) return { error: "Indiquez votre identifiant PayPal.me.", fieldErrors: { paypalMe: "Requis." } };

  const [current] = await db.select().from(paymentSettings).where(eq(paymentSettings.businessId, ctx.business.id));
  let qrImage = current?.accepted.qrCode.imageUrl;
  const file = fd.get("qrImage");
  if (file instanceof File && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) return { error: "Image trop lourde (3 Mo maximum).", fieldErrors: { qrImage: "3 Mo maximum." } };
    try {
      const url = await savePublicImage(Buffer.from(await file.arrayBuffer()));
      await deletePublicImage(qrImage);
      qrImage = url;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Image invalide." };
    }
  } else if (fd.get("removeQr") === "1") {
    await deletePublicImage(qrImage);
    qrImage = undefined;
  }

  await db
    .update(paymentSettings)
    .set({
      prepaymentEnabled: v.prepaymentEnabled,
      prepaymentRequired: v.prepaymentEnabled && v.prepaymentRequired,
      cancellationRule: v.cancellationRule,
      accepted: {
        cash: v.cash,
        cardOnSite: v.cardOnSite,
        bankTransfer: { enabled: v.bankTransfer.enabled, iban: v.bankTransfer.iban || undefined, bic: v.bankTransfer.bic || undefined, bankName: v.bankTransfer.bankName || undefined, note: v.bankTransfer.note || undefined },
        paypal: { enabled: v.paypal.enabled, paypalMe: v.paypal.paypalMe || undefined },
        qrCode: { enabled: v.qrEnabled && !!qrImage, imageUrl: qrImage, note: v.qrNote || undefined },
      },
      payout: v.payout.method ? { method: v.payout.method, iban: v.payout.iban || undefined, bic: v.payout.bic || undefined, paypalEmail: v.payout.paypalEmail || undefined, other: v.payout.other || undefined } : {},
    })
    .where(eq(paymentSettings.businessId, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "settings.payments", description: "Réglages de paiement modifiés" });
  revalidatePath("/app/reglages/paiements");
  return { ok: true };
}

export async function disconnectStripe(): Promise<{ ok: boolean }> {
  const ctx = await requireContext("billing.manage");
  await db.update(paymentSettings).set({ stripeAccountId: null, stripeStatus: "not_connected", stripeAccountEmail: null }).where(eq(paymentSettings.businessId, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "stripe.disconnect", description: "Compte Stripe déconnecté" });
  revalidatePath("/app/reglages/paiements");
  return { ok: true };
}

/** Compte Stripe existant saisi à la main (acct_…), vérifié auprès de Stripe. */
export async function linkStripeAccount(accountId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("billing.manage");
  if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  if (!/^acct_[A-Za-z0-9]{8,}$/.test(accountId.trim())) return { ok: false, error: "L'identifiant doit commencer par acct_." };
  const s = stripe();
  if (!s) return { ok: false, error: "Stripe n'est pas configuré sur ce serveur." };
  let email: string | null = null;
  let active = false;
  try {
    const acc = await s.accounts.retrieve(accountId.trim());
    // Preuve de propriété : compte créé pour CET établissement, ou ouvert avec l'adresse email de la personne connectée.
    // Sinon, n'importe quel membre pourrait lier (et ouvrir) le compte Stripe d'un autre pro.
    const own = acc.metadata?.businessId === ctx.business.id || (!!acc.email && acc.email.toLowerCase() === ctx.user.email.toLowerCase());
    if (!own) return { ok: false, error: "Compte Stripe introuvable ou non relié à Branshee." };
    email = acc.email ?? acc.business_profile?.support_email ?? null;
    active = !!acc.details_submitted;
  } catch {
    return { ok: false, error: "Compte Stripe introuvable ou non relié à Branshee." };
  }
  await db.update(paymentSettings).set({ stripeAccountId: accountId.trim(), stripeStatus: active ? "active" : "pending", stripeAccountEmail: email }).where(eq(paymentSettings.businessId, ctx.business.id));
  revalidatePath("/app/reglages/paiements");
  return { ok: true };
}
