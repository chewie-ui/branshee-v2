"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminMessageDismissals, adminMessages, supportMessages, supportRatings, supportThreads } from "@/db/schema";
import { requireUser } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { getSupportThread } from "@/server/support";

type Result = { ok: boolean; error?: string };
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/** Le pro écrit à l'équipe Branshee (rouvre la conversation si elle avait été clôturée). */
export async function sendSupportMessage(body: string): Promise<Result> {
  const user = await requireUser();
  const text = String(body ?? "").trim();
  if (!text) return { ok: false, error: "Écrivez votre message." };
  if (text.length > 4000) return { ok: false, error: "Message trop long (4 000 caractères maximum)." };
  // Anti-abus simple : pas plus de 20 messages en 10 minutes.
  const [recent] = await db.execute<{ n: number }>(sql`select count(*)::int as n from support_messages where thread_user_id = ${user.id} and sender = 'user' and created_at > now() - interval '10 minutes'`);
  if (Number(recent?.n ?? 0) >= 20) return { ok: false, error: "Vous avez envoyé beaucoup de messages : patientez quelques minutes." };
  await db
    .insert(supportThreads)
    .values({ userId: user.id, unreadByAdmin: 1, lastMessageAt: new Date() })
    .onConflictDoUpdate({ target: supportThreads.userId, set: { unreadByAdmin: sql`${supportThreads.unreadByAdmin} + 1`, lastMessageAt: new Date(), closedAt: null } });
  await db.insert(supportMessages).values({ threadUserId: user.id, sender: "user", body: text });
  const to = process.env.SUPPORT_EMAIL;
  if (to) {
    after(async () => {
      const mail = emails.supportNewMessage({ from: user.name, email: user.email, body: text, url: `${appUrl()}/admin/support?u=${user.id}` });
      await sendEmail({ to, ...mail, template: "support_new_message", replyTo: user.email });
    });
  }
  revalidatePath("/app/aide");
  return { ok: true };
}

/** Rafraîchissement de la discussion (toutes les quelques secondes quand elle est ouverte). */
export async function fetchSupportThread() {
  const user = await requireUser();
  const data = await getSupportThread(user.id);
  if (data.thread?.unreadByUser) await db.update(supportThreads).set({ unreadByUser: 0 }).where(eq(supportThreads.userId, user.id));
  return data;
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
  revalidatePath("/app/aide");
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
