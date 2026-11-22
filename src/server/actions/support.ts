"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { adminMessageDismissals, adminMessages, supportMessages, supportRatings, supportThreads } from "@/db/schema";
import { requireUser } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { supportLive } from "@/server/support";
import { getSessionUser } from "@/server/auth/session";
import { currentBrand } from "@/server/brand";
import { storeSupportImage } from "@/server/support-image";

type Result = { ok: boolean; error?: string };
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
const welcome = (firstName: string, brand: string) =>
  `Bonjour ${firstName} ! Merci de nous écrire. Notre équipe ${brand} vous répond le plus vite possible, en général en quelques minutes en journée. Décrivez votre question ici, vous pouvez aussi joindre une capture d'écran.`;

/** « Démarrer le chat » : ouvre (ou rouvre) la discussion avec un message d'accueil de l'équipe. */
export async function startSupportChat(): Promise<Result> {
  const user = await requireUser();
  const [t] = await db.select({ closedAt: supportThreads.closedAt }).from(supportThreads).where(eq(supportThreads.userId, user.id));
  if (t && !t.closedAt) return { ok: true };
  await db
    .insert(supportThreads)
    .values({ userId: user.id, lastMessageAt: new Date() })
    .onConflictDoUpdate({ target: supportThreads.userId, set: { closedAt: null, closedBy: null, rating: null, lastMessageAt: new Date() } });
  await db.insert(supportMessages).values({ threadUserId: user.id, sender: "admin", kind: "system", body: welcome(user.name.split(" ")[0] ?? "", (await currentBrand()).name) });
  return { ok: true };
}

/** Le pro écrit à l'équipe (texte et / ou image) ; rouvre la discussion si elle était terminée. */
export async function sendSupportMessage(fd: FormData): Promise<Result & { id?: string }> {
  const user = await requireUser();
  const text = String(fd.get("body") ?? "").trim();
  if (text.length > 4000) return { ok: false, error: "Message trop long (4 000 caractères maximum)." };
  // Anti-abus simple : pas plus de 30 messages en 10 minutes.
  const [recent] = await db.execute<{ n: number; last: string | null }>(sql`select count(*)::int as n, max(created_at)::text as last from support_messages where thread_user_id = ${user.id} and sender = 'user' and created_at > now() - interval '10 minutes'`);
  if (Number(recent?.n ?? 0) >= 30) return { ok: false, error: "Vous avez envoyé beaucoup de messages : patientez quelques minutes." };
  const img = await storeSupportImage(fd.get("image"));
  if (!img.ok) return img;
  if (!text && !img.ref) return { ok: false, error: "Écrivez votre message." };
  await db
    .insert(supportThreads)
    .values({ userId: user.id, unreadByAdmin: 1, lastMessageAt: new Date() })
    .onConflictDoUpdate({ target: supportThreads.userId, set: { unreadByAdmin: sql`${supportThreads.unreadByAdmin} + 1`, lastMessageAt: new Date(), closedAt: null, closedBy: null, userTypingAt: null } });
  const [m] = await db.insert(supportMessages).values({ threadUserId: user.id, sender: "user", body: text, imageRef: img.ref }).returning({ id: supportMessages.id });
  // Email à l'équipe pour le premier message d'une série (pas un email par ligne quand on discute en direct).
  const to = process.env.SUPPORT_EMAIL;
  if (to && !Number(recent?.n ?? 0)) {
    after(async () => {
      const mail = emails.supportNewMessage({ from: user.name, email: user.email, body: text || "(image)", url: `${appUrl()}/admin/support?u=${user.id}` });
      await sendEmail({ to, ...mail, template: "support_new_message", replyTo: user.email });
    });
  }
  return { ok: true, id: m?.id };
}

/** « En train d'écrire… » (appelé au plus toutes les 3 secondes pendant la frappe). */
export async function supportTyping(): Promise<void> {
  const session = await getSessionUser();
  if (!session || session.impersonatedById) return;
  await db.update(supportThreads).set({ userTypingAt: new Date() }).where(eq(supportThreads.userId, session.user.id));
}

/** Le pro termine la discussion (il peut ensuite la noter ; un nouveau message la rouvre). */
export async function endSupportChat(): Promise<Result> {
  const user = await requireUser();
  const [t] = await db.update(supportThreads).set({ closedAt: new Date(), closedBy: "user", rating: null, userTypingAt: null }).where(and(eq(supportThreads.userId, user.id), isNull(supportThreads.closedAt))).returning({ id: supportThreads.userId });
  if (t) await db.insert(supportMessages).values({ threadUserId: user.id, sender: "user", kind: "system", body: "Discussion terminée." });
  return { ok: true };
}

/** Rafraîchissement de la discussion (page d'aide). */
export async function fetchSupportThread() {
  const user = await requireUser();
  return supportLive(user.id, "user", { markRead: true });
}

/** Note de satisfaction après la clôture d'une conversation (une fois par clôture). */
export async function rateSupport(rating: number): Promise<Result> {
  const user = await requireUser();
  const r = z.number().int().min(1).max(5).safeParse(rating);
  if (!r.success) return { ok: false, error: "Note invalide." };
  const [t] = await db.select({ closedAt: supportThreads.closedAt, rating: supportThreads.rating }).from(supportThreads).where(eq(supportThreads.userId, user.id));
  if (!t?.closedAt) return { ok: false, error: "Aucune conversation à noter." };
  if (t.rating) return { ok: true };
  await db.update(supportThreads).set({ rating: r.data }).where(eq(supportThreads.userId, user.id));
  await db.insert(supportRatings).values({ userId: user.id, rating: r.data });
  return { ok: true };
}

/** Ferme un message de l'équipe Branshee pour ce compte. */
export async function dismissAdminMessage(messageId: string): Promise<Result> {
  const user = await requireUser();
  const id = z.uuid().safeParse(messageId);
  if (!id.success) return { ok: false };
  const [m] = await db.select({ id: adminMessages.id }).from(adminMessages).where(eq(adminMessages.id, id.data));
  if (!m) return { ok: false };
  await db.insert(adminMessageDismissals).values({ messageId: id.data, userId: user.id }).onConflictDoNothing();
  revalidatePath("/app", "layout");
  return { ok: true };
}
