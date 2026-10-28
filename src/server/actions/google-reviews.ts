"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, members, reviewRequests, reviewSettings, users } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { normalizeGoogleUrl } from "@/lib/google-reviews";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { deliverReviewRequest, newReviewToken, requestByToken, reviewOrigin, reviewRights, reviewSettingsOf } from "@/server/google-reviews";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/avis", "layout");

const settingsSchema = z.object({
  googleUrl: z.string().trim().max(500),
  autoSend: z.boolean(),
  delayHours: z.number().int().min(1).max(72),
  minDaysBetween: z.number().int().min(7).max(730),
  message: z.string().trim().max(500),
});

export async function saveReviewSettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!reviewRights(ctx).settings) return { ok: false, error: "Seul le responsable peut modifier ces réglages." };
  const v = settingsSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez les réglages." };
  const url = v.data.googleUrl ? normalizeGoogleUrl(v.data.googleUrl) : null;
  if (v.data.googleUrl && !url) return { ok: false, error: "Ce lien n'est pas un lien Google. Copiez le lien « Demander des avis » de votre fiche Google, ou votre identifiant de lieu (ChIJ…)." };
  if (v.data.autoSend && !url) return { ok: false, error: "Ajoutez d'abord le lien de votre fiche Google." };
  await reviewSettingsOf(ctx.business.id);
  await db.update(reviewSettings).set({ googleUrl: url, autoSend: v.data.autoSend, delayHours: v.data.delayHours, minDaysBetween: v.data.minDaysBetween, message: v.data.message || null, updatedAt: new Date() }).where(eq(reviewSettings.businessId, ctx.business.id));
  refresh();
  return { ok: true, message: "Réglages enregistrés." };
}

export async function regenerateReviewQr(): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!reviewRights(ctx).settings) return { ok: false, error: "Seul le responsable peut faire ça." };
  await reviewSettingsOf(ctx.business.id);
  await db.update(reviewSettings).set({ qrToken: newReviewToken(), updatedAt: new Date() }).where(eq(reviewSettings.businessId, ctx.business.id));
  refresh();
  return { ok: true, message: "Nouveau QR code créé : réimprimez l'affiche." };
}

/** Demander un avis à un client précis (fiche client ou adresse email). */
export async function sendReviewRequest(input: { customerId?: string; email?: string; name?: string }): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!reviewRights(ctx).send) return { ok: false, error: "Vous n'avez pas le droit de contacter les clients." };
  const s = await reviewSettingsOf(ctx.business.id);
  if (!s.googleUrl) return { ok: false, error: "Ajoutez d'abord le lien de votre fiche Google dans les réglages." };
  if (!rateLimit(`review-send:${ctx.business.id}`, 100, 3600_000).ok) return { ok: false, error: "Beaucoup de demandes envoyées : réessayez dans une heure." };
  let to: { email: string; name: string | null; customerId: string | null };
  if (input.customerId) {
    if (!z.uuid().safeParse(input.customerId).success) return { ok: false, error: "Client introuvable." };
    const [c] = await db.select({ id: customers.id, email: customers.email, name: customers.fullName }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.businessId, ctx.business.id)));
    if (!c) return { ok: false, error: "Client introuvable." };
    if (!c.email) return { ok: false, error: "Ce client n'a pas d'adresse email." };
    to = { email: c.email, name: c.name, customerId: c.id };
  } else {
    const e = z.email().safeParse((input.email ?? "").trim().toLowerCase());
    if (!e.success) return { ok: false, error: "Adresse email invalide." };
    const [c] = await db.select({ id: customers.id, name: customers.fullName }).from(customers).where(and(eq(customers.businessId, ctx.business.id), sql`lower(${customers.email}) = ${e.data}`));
    to = { email: e.data, name: (input.name ?? "").trim().slice(0, 80) || c?.name || null, customerId: c?.id ?? null };
  }
  const since = new Date(Date.now() - 7 * 86400_000);
  const [recent] = await db.select({ id: reviewRequests.id }).from(reviewRequests).where(and(eq(reviewRequests.businessId, ctx.business.id), sql`lower(${reviewRequests.email}) = ${to.email.toLowerCase()}`, gte(reviewRequests.createdAt, since)));
  if (recent) return { ok: false, error: "Une demande a déjà été envoyée à cette personne cette semaine." };
  const sent = await deliverReviewRequest(ctx.business.id, to);
  refresh();
  return sent ? { ok: true, message: `Demande envoyée à ${to.name ?? to.email}.` } : { ok: false, error: "L'email n'a pas pu partir. Réessayez plus tard." };
}

const feedbackSchema = z.object({ token: z.string().regex(/^[\w-]{10,40}$/), rating: z.number().int().min(1).max(5), text: z.string().trim().min(3, "Écrivez quelques mots.").max(2000) });

/** Remarque privée d'un client (page publique), transmise au responsable. */
export async function submitPrivateFeedback(input: z.input<typeof feedbackSchema>): Promise<Result> {
  const v = feedbackSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Message invalide." };
  const ip = clientIp(await headers()) ?? "inconnue";
  if (!rateLimit(`review-fb:${ip}`, 5, 3600_000).ok) return { ok: false, error: "Trop de messages. Réessayez plus tard." };
  const r = await requestByToken(v.data.token);
  if (!r) return { ok: false, error: "Ce lien n'est plus valable." };
  if (r.req.feedbackAt) return { ok: false, error: "Merci, votre message a déjà été transmis." };
  await db.update(reviewRequests).set({ feedbackRating: v.data.rating, feedback: v.data.text, feedbackAt: new Date() }).where(eq(reviewRequests.id, r.req.id));
  const [owner] = await db.select({ email: users.email }).from(members).innerJoin(users, eq(users.id, members.userId)).where(and(eq(members.businessId, r.business.id), eq(members.isOwner, true)));
  if (owner) await sendEmail({ to: owner.email, ...emails.reviewFeedback({ businessName: r.business.name, name: r.req.name, rating: v.data.rating, text: v.data.text, url: `${reviewOrigin()}/app/avis/remarques` }), template: "review_feedback", businessId: r.business.id }).catch(() => {});
  return { ok: true, message: "Merci ! Votre message a été transmis directement au responsable." };
}
