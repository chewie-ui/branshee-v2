"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, businesses, reviewReports, reviews } from "@/db/schema";
import { rateLimit } from "@/server/auth/rate-limit";
import { getSessionUser } from "@/server/auth/session";
import { reviewEligibility } from "@/server/client-account";
import { requireContext } from "@/server/context";
import { clientIp } from "@/lib/client-ip";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choisissez une note de 1 à 5.").max(5),
  comment: z.string().trim().max(800, "800 caractères maximum."),
});

/** Laisser un avis : compte connecté avec adresse vérifiée, un seul avis par établissement, pas sur le sien. */
export async function submitReview(slug: string, input: { rating: number; comment: string }): Promise<Result> {
  const s = await getSessionUser();
  if (!s) return { ok: false, error: "Connectez-vous pour laisser un avis." };
  if (!s.user.emailVerifiedAt) return { ok: false, error: "Confirmez d'abord votre adresse email." };
  if (!rateLimit(`review:${s.user.id}`, 5, 60 * 60 * 1000).ok) return { ok: false, error: "Trop d'avis envoyés. Réessayez plus tard." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, String(slug).toLowerCase()));
  if (!biz) return { ok: false, error: "Établissement introuvable." };
  const can = await reviewEligibility(s.user.id, biz.id);
  if (!can.ok) return { ok: false, error: can.reason === "own" ? "Vous ne pouvez pas laisser un avis sur votre propre établissement." : "Vous avez déjà laissé un avis ici." };
  try {
    await db.insert(reviews).values({ businessId: biz.id, userId: s.user.id, authorName: s.user.fullName, authorAvatarUrl: s.user.avatarUrl, rating: parsed.data.rating, comment: parsed.data.comment || null });
  } catch {
    return { ok: false, error: "Vous avez déjà laissé un avis ici." };
  }
  revalidatePath(`/${slug}`);
  return { ok: true, message: "Merci pour votre avis !" };
}

export async function deleteMyReview(reviewId: string): Promise<Result> {
  const s = await getSessionUser();
  if (!s) return { ok: false, error: "Connectez-vous." };
  const id = z.uuid().safeParse(reviewId);
  if (!id.success) return { ok: false, error: "Avis introuvable." };
  const deleted = await db.delete(reviews).where(and(eq(reviews.id, id.data), eq(reviews.userId, s.user.id))).returning({ businessId: reviews.businessId });
  if (!deleted.length) return { ok: false, error: "Avis introuvable." };
  revalidatePath("/espace-client/avis");
  return { ok: true, message: "Avis supprimé." };
}

const reportSchema = z.object({
  reason: z.enum(["insulting", "false", "spam", "personal", "other"], { message: "Choisissez un motif." }),
  message: z.string().trim().max(1000),
});

async function fingerprint(userId: string | null) {
  if (userId) return `u:${userId}`;
  const h = await headers();
  const ip = (clientIp(h) ?? "");
  return `v:${createHash("sha256").update(`${ip}|${h.get("user-agent") ?? ""}`).digest("hex").slice(0, 32)}`;
}

/**
 * Signaler un avis (ouvert à tous, y compris visiteurs). Personne ne supprime directement :
 * l'équipe Branshee tranche. Le pro passe par sa propre demande (`requestReviewRemoval`).
 */
export async function reportReview(reviewId: string, input: { reason: string; message: string }): Promise<Result> {
  const s = await getSessionUser();
  const h = await headers();
  if (!rateLimit(`report:${clientIp(h) ?? "?"}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de signalements envoyés. Réessayez plus tard." };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const id = z.uuid().safeParse(reviewId);
  if (!id.success) return { ok: false, error: "Avis introuvable." };
  const [r] = await db.select().from(reviews).where(eq(reviews.id, id.data));
  if (!r) return { ok: false, error: "Avis introuvable." };
  const fp = await fingerprint(s?.user.id ?? null);
  const [already] = await db.select({ id: reviewReports.id }).from(reviewReports).where(and(eq(reviewReports.reviewId, r.id), eq(reviewReports.reporterFingerprint, fp)));
  if (already) return { ok: false, error: "Vous avez déjà signalé cet avis. Il est en cours d'examen." };
  await db.insert(reviewReports).values({
    reviewId: r.id,
    businessId: r.businessId,
    reporterKind: s ? "user" : "visitor",
    reporterUserId: s?.user.id ?? null,
    reporterFingerprint: fp,
    reason: parsed.data.reason,
    message: parsed.data.message || null,
    snapshot: { authorName: r.authorName, rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString() },
  });
  return { ok: true, message: "Merci, ce signalement a été transmis à notre équipe." };
}

/** Le pro demande la suppression d'un avis sur son établissement ; l'équipe Branshee décide. */
export async function requestReviewRemoval(reviewId: string, input: { reason: string; message: string }): Promise<Result> {
  const ctx = await requireContext("customization.manage", { write: true });
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const id = z.uuid().safeParse(reviewId);
  if (!id.success) return { ok: false, error: "Avis introuvable." };
  const [r] = await db.select().from(reviews).where(and(eq(reviews.id, id.data), eq(reviews.businessId, ctx.business.id)));
  if (!r) return { ok: false, error: "Avis introuvable." };
  const fp = `u:${ctx.user.id}`;
  const [already] = await db.select({ id: reviewReports.id }).from(reviewReports).where(and(eq(reviewReports.reviewId, r.id), eq(reviewReports.reporterFingerprint, fp)));
  if (already) return { ok: false, error: "Demande déjà envoyée : elle est en cours d'examen." };
  await db.insert(reviewReports).values({
    reviewId: r.id,
    businessId: r.businessId,
    reporterKind: "owner",
    reporterUserId: ctx.user.id,
    reporterFingerprint: fp,
    reason: parsed.data.reason,
    message: parsed.data.message || null,
    snapshot: { authorName: r.authorName, rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString() },
  });
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "review.removal_request", description: `Demande de suppression de l'avis de ${r.authorName}` });
  revalidatePath("/app/page-de-reservation/avis");
  return { ok: true, message: "Demande transmise. Elle sera examinée sous peu." };
}
