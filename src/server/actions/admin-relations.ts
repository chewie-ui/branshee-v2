"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { adminMessages, helpSections, reviewReports, reviews, supportMessages, supportThreads, users } from "@/db/schema";
import { requireSuperadmin } from "@/server/admin";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { sanitizeArticleHtml } from "@/server/rich-text";

type Result = { ok: boolean; error?: string; message?: string };
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

// ─── Support ─────────────────────────────────────────────────────────────────

/** Réponse de l'équipe : visible dans l'aide du pro, badge non lu, et email de notification. */
export async function replySupport(userId: string, body: string): Promise<Result> {
  await requireSuperadmin();
  const id = z.uuid().parse(userId);
  const text = String(body ?? "").trim();
  if (!text) return { ok: false, error: "Écrivez une réponse." };
  if (text.length > 4000) return { ok: false, error: "Réponse trop longue." };
  const [t] = await db
    .update(supportThreads)
    .set({ unreadByUser: sql`${supportThreads.unreadByUser} + 1`, unreadByAdmin: 0, lastMessageAt: new Date(), closedAt: null })
    .where(eq(supportThreads.userId, id))
    .returning({ id: supportThreads.userId });
  if (!t) return { ok: false, error: "Conversation introuvable." };
  await db.insert(supportMessages).values({ threadUserId: id, sender: "admin", body: text });
  const [u] = await db.select({ email: users.email, name: users.fullName }).from(users).where(eq(users.id, id));
  if (u) after(() => sendEmail({ to: u.email, ...emails.supportReply({ name: u.name.split(" ")[0] ?? u.name, body: text, url: `${appUrl()}/app/aide#contact` }), template: "support_reply" }).then(() => undefined));
  revalidatePath("/admin/support");
  return { ok: true };
}

/** Clôture : le pro est invité à noter l'échange ; un nouveau message de sa part rouvre la conversation. */
export async function closeSupport(userId: string): Promise<Result> {
  await requireSuperadmin();
  const id = z.uuid().parse(userId);
  await db.update(supportThreads).set({ closedAt: new Date(), rating: null, unreadByAdmin: 0, unreadByUser: sql`${supportThreads.unreadByUser} + 1` }).where(eq(supportThreads.userId, id));
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function deleteSupportThread(userId: string): Promise<Result> {
  await requireSuperadmin();
  await db.delete(supportThreads).where(eq(supportThreads.userId, z.uuid().parse(userId)));
  revalidatePath("/admin/support");
  return { ok: true };
}

// ─── Messages aux pros ───────────────────────────────────────────────────────

const messageSchema = z.object({
  audience: z.enum(["all", "some"]),
  emails: z.string().max(20000),
  type: z.enum(["info", "warning", "security", "success", "tip"]),
  title: z.string().trim().min(1, "Titre requis.").max(140),
  body: z.string().trim().min(1, "Message requis.").max(4000),
  ctaLabel: z.string().trim().max(60),
  ctaUrl: z.string().trim().max(500).refine((v) => !v || /^(\/|https:\/\/)/.test(v), "Lien : une page (/app/…) ou une adresse https://"),
});

/** Message affiché en bannière dans l'espace pro : à tous, ou à une liste d'emails. */
export async function sendAdminMessage(input: z.input<typeof messageSchema>): Promise<Result> {
  await requireSuperadmin();
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const d = parsed.data;
  const base = { title: d.title, body: d.body, type: d.type, ctaLabel: d.ctaLabel || null, ctaUrl: d.ctaLabel && d.ctaUrl ? d.ctaUrl : null };
  if (d.audience === "all") {
    await db.insert(adminMessages).values({ ...base, recipientId: null });
    revalidatePath("/admin/messages");
    return { ok: true, message: "Message publié pour tous les pros." };
  }
  const list = [...new Set(d.emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return { ok: false, error: "Indiquez au moins un email." };
  const found = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(sql`lower(${users.email})`, list));
  if (!found.length) return { ok: false, error: "Aucun compte trouvé pour ces emails." };
  await db.insert(adminMessages).values(found.map((u) => ({ ...base, recipientId: u.id })));
  const missing = list.filter((e) => !found.some((f) => f.email.toLowerCase() === e));
  revalidatePath("/admin/messages");
  return { ok: true, message: `Envoyé à ${found.length} compte${found.length > 1 ? "s" : ""}.${missing.length ? ` Introuvable${missing.length > 1 ? "s" : ""} : ${missing.join(", ")}` : ""}` };
}

export async function deleteAdminMessage(id: string): Promise<Result> {
  await requireSuperadmin();
  await db.delete(adminMessages).where(eq(adminMessages.id, z.uuid().parse(id)));
  revalidatePath("/admin/messages");
  return { ok: true };
}

// ─── Centre d'aide ───────────────────────────────────────────────────────────

const sectionSchema = z.object({
  id: z.uuid().nullable(),
  title: z.string().trim().min(1, "Titre de section requis.").max(120),
  videos: z.array(z.object({ id: z.string().max(64), title: z.string().trim().min(1, "Titre de vidéo requis.").max(160), url: z.string().trim().max(500).refine((v) => !v || /^https:\/\//.test(v), "Lien vidéo : adresse https://"), duration: z.string().trim().max(20) })).max(30),
  faqs: z.array(z.object({ id: z.string().max(64), question: z.string().trim().min(1, "Question requise.").max(300), answer: z.string().max(20000) })).max(60),
});

export async function saveHelpSection(input: z.input<typeof sectionSchema>): Promise<Result & { id?: string }> {
  await requireSuperadmin();
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Section invalide." };
  const d = parsed.data;
  const values = {
    title: d.title,
    videos: d.videos.map((v) => ({ id: v.id || randomUUID(), title: v.title, url: v.url, duration: v.duration || undefined })),
    faqs: d.faqs.filter((f) => f.answer.trim()).map((f) => ({ id: f.id || randomUUID(), question: f.question, answer: sanitizeArticleHtml(f.answer) })),
  };
  let id = d.id;
  if (id) await db.update(helpSections).set(values).where(eq(helpSections.id, id));
  else {
    const [max] = await db.select({ n: sql<number>`coalesce(max(${helpSections.position}), -1)::int` }).from(helpSections);
    const [row] = await db.insert(helpSections).values({ ...values, position: (max?.n ?? -1) + 1 }).returning({ id: helpSections.id });
    id = row!.id;
  }
  revalidatePath("/admin/aide");
  revalidatePath("/app/aide");
  return { ok: true, id, message: "Section enregistrée." };
}

export async function deleteHelpSection(id: string): Promise<Result> {
  await requireSuperadmin();
  await db.delete(helpSections).where(eq(helpSections.id, z.uuid().parse(id)));
  revalidatePath("/admin/aide");
  revalidatePath("/app/aide");
  return { ok: true };
}

export async function moveHelpSection(id: string, dir: "up" | "down"): Promise<Result> {
  await requireSuperadmin();
  const all = await db.select({ id: helpSections.id }).from(helpSections).orderBy(asc(helpSections.position), asc(helpSections.createdAt));
  const i = all.findIndex((s) => s.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j]!, all[i]!];
  await db.transaction(async (tx) => {
    for (const [pos, s] of all.entries()) await tx.update(helpSections).set({ position: pos }).where(eq(helpSections.id, s.id));
  });
  revalidatePath("/admin/aide");
  revalidatePath("/app/aide");
  return { ok: true };
}

// ─── Avis signalés ───────────────────────────────────────────────────────────

/** Signalement accepté → l'avis est supprimé ; refusé → il reste. Tous les signalements du même avis sont tranchés. */
export async function decideReviewReport(reportId: string, decision: "accepted" | "rejected", note: string): Promise<Result> {
  await requireSuperadmin();
  const id = z.uuid().parse(reportId);
  if (!["accepted", "rejected"].includes(decision)) return { ok: false, error: "Décision invalide." };
  const [r] = await db.select().from(reviewReports).where(eq(reviewReports.id, id));
  if (!r) return { ok: false, error: "Signalement introuvable." };
  const values = { status: decision, decidedAt: new Date(), decisionNote: String(note ?? "").trim().slice(0, 500) || null };
  if (r.reviewId) await db.update(reviewReports).set(values).where(and(eq(reviewReports.reviewId, r.reviewId), eq(reviewReports.status, "pending")));
  else await db.update(reviewReports).set(values).where(eq(reviewReports.id, id));
  if (decision === "accepted" && r.reviewId) await db.delete(reviews).where(eq(reviews.id, r.reviewId));
  revalidatePath("/admin/signalements");
  return { ok: true, message: decision === "accepted" ? "Avis supprimé." : "Avis conservé." };
}
