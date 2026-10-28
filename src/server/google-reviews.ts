import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, reviewRequests, reviewSettings } from "@/db/schema";
import { DEFAULT_MESSAGE } from "@/lib/google-reviews";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import type { AppContext } from "@/server/context";

export const newReviewToken = () => randomBytes(12).toString("base64url");
export const reviewRights = (ctx: AppContext) => ({ settings: ctx.member.isOwner || ctx.can("settings.manage"), send: ctx.can("customers.manage") });
export const reviewOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

/** Réglages de l'établissement (créés au premier passage, avec le jeton du QR code). */
export async function reviewSettingsOf(businessId: string) {
  const [s] = await db.select().from(reviewSettings).where(eq(reviewSettings.businessId, businessId));
  if (s) return s;
  await db.insert(reviewSettings).values({ businessId, qrToken: newReviewToken() }).onConflictDoNothing();
  const [created] = await db.select().from(reviewSettings).where(eq(reviewSettings.businessId, businessId));
  return created!;
}

/** Chiffres des 90 derniers jours. */
export async function reviewStats(businessId: string) {
  const since = new Date(Date.now() - 90 * 86400_000);
  const [r] = await db
    .select({
      sent: sql<number>`count(*) filter (where ${reviewRequests.channel} = 'email')::int`,
      scans: sql<number>`count(*) filter (where ${reviewRequests.channel} = 'qr')::int`,
      opened: sql<number>`count(${reviewRequests.openedAt})::int`,
      clicked: sql<number>`count(${reviewRequests.googleClickedAt})::int`,
      feedback: sql<number>`count(${reviewRequests.feedbackAt})::int`,
    })
    .from(reviewRequests)
    .where(and(eq(reviewRequests.businessId, businessId), gte(reviewRequests.createdAt, since)));
  return r ?? { sent: 0, scans: 0, opened: 0, clicked: 0, feedback: 0 };
}

export async function recentRequests(businessId: string) {
  return db.select().from(reviewRequests).where(and(eq(reviewRequests.businessId, businessId), eq(reviewRequests.channel, "email"))).orderBy(desc(reviewRequests.createdAt)).limit(100);
}

export async function privateFeedback(businessId: string) {
  return db.select().from(reviewRequests).where(and(eq(reviewRequests.businessId, businessId), isNotNull(reviewRequests.feedbackAt))).orderBy(desc(reviewRequests.feedbackAt)).limit(200);
}

/** Page publique d'une demande : établissement visible et lien Google configuré. */
export async function requestByToken(token: string) {
  if (!/^[\w-]{10,40}$/.test(token)) return null;
  const [r] = await db
    .select({ req: reviewRequests, business: { id: businesses.id, name: businesses.name, photoUrl: businesses.photoUrl }, googleUrl: reviewSettings.googleUrl })
    .from(reviewRequests)
    .innerJoin(businesses, eq(businesses.id, reviewRequests.businessId))
    .leftJoin(reviewSettings, eq(reviewSettings.businessId, reviewRequests.businessId))
    .where(and(eq(reviewRequests.token, token), isNull(businesses.deletedAt)));
  return r ?? null;
}

export async function settingsByQr(token: string) {
  if (!/^[\w-]{10,40}$/.test(token)) return null;
  const [r] = await db.select({ businessId: reviewSettings.businessId }).from(reviewSettings).innerJoin(businesses, eq(businesses.id, reviewSettings.businessId)).where(and(eq(reviewSettings.qrToken, token), isNull(businesses.deletedAt)));
  return r ?? null;
}

/** Envoie la demande d'avis par email (utilisé à la main et par la tâche automatique). */
export async function deliverReviewRequest(businessId: string, to: { email: string; name: string | null; customerId: string | null; appointmentId?: string | null }) {
  const s = await reviewSettingsOf(businessId);
  if (!s.googleUrl) return false;
  const [b] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, businessId));
  const token = newReviewToken();
  const inserted = await db.insert(reviewRequests).values({ businessId, customerId: to.customerId, appointmentId: to.appointmentId ?? null, channel: "email", email: to.email, name: to.name, token, sentAt: new Date() }).onConflictDoNothing().returning({ id: reviewRequests.id });
  if (!inserted.length) return false;
  const mail = emails.reviewRequest({ businessName: b?.name ?? "", name: to.name?.split(" ")[0] ?? null, message: s.message || DEFAULT_MESSAGE, url: `${reviewOrigin()}/avis/${token}`, googleUrl: `${reviewOrigin()}/avis/${token}/google` });
  return sendEmail({ to: to.email, ...mail, template: "review_request", businessId });
}

