import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, contactMessages, customers, users } from "@/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { emitWebhook } from "@/server/connect";

export type ContactInput = { name: string; email: string | null; phone: string | null; subject: string | null; message: string; pageUrl: string | null };

/**
 * Message reçu depuis le site du pro (widget, mini-site ou API) : rangé dans « Messages » (app Clients),
 * fiche client créée ou complétée, email au responsable, webhook « contact.created ».
 */
export async function recordContact(businessId: string, input: ContactInput, source: "widget" | "api" | "site") {
  const [biz] = await db.select({ name: businesses.name, ownerEmail: users.email, demo: businesses.isDemo }).from(businesses).innerJoin(users, eq(users.id, businesses.ownerId)).where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)));
  if (!biz) return null;
  const email = input.email?.toLowerCase() || null;
  let customerId: string | null = null;
  if (email) {
    const [c] = await db.select({ id: customers.id, phone: customers.phone, blocked: customers.blockedAt }).from(customers).where(and(eq(customers.businessId, businessId), sql`lower(${customers.email}) = ${email}`));
    if (c && !c.blocked) {
      customerId = c.id;
      if (!c.phone && input.phone) await db.update(customers).set({ phone: input.phone }).where(eq(customers.id, c.id));
    } else if (!c) {
      const [first, ...rest] = input.name.trim().split(/\s+/);
      const [row] = await db.insert(customers).values({ businessId, fullName: input.name.trim(), firstName: first ?? null, lastName: rest.join(" ") || null, email, phone: input.phone, createdManually: true }).returning({ id: customers.id });
      customerId = row!.id;
    }
  }
  const [msg] = await db.insert(contactMessages).values({ businessId, customerId, name: input.name.trim(), email, phone: input.phone, subject: input.subject, message: input.message, source: source === "site" ? "widget" : source, pageUrl: input.pageUrl }).returning({ id: contactMessages.id, createdAt: contactMessages.createdAt });
  if (!biz.demo) {
    const mail = emails.siteContact({ businessName: biz.name, name: input.name, email: email ?? (input.phone ? `tél. ${input.phone}` : "sans email"), message: [input.subject ? `Sujet : ${input.subject}` : null, input.message, input.phone ? `Téléphone : ${input.phone}` : null].filter(Boolean).join("\n\n") });
    await sendEmail({ to: biz.ownerEmail, ...mail, template: "site_contact", replyTo: email, businessId }).catch(() => false);
    await emitWebhook(businessId, "contact.created", { id: msg!.id, name: input.name, email, phone: input.phone, subject: input.subject, message: input.message, pageUrl: input.pageUrl, customerId, createdAt: msg!.createdAt.toISOString() });
  }
  return { id: msg!.id, customerId };
}

export async function contactMessagesOf(businessId: string) {
  return db.select().from(contactMessages).where(eq(contactMessages.businessId, businessId)).orderBy(desc(contactMessages.createdAt)).limit(300);
}

export async function unreadContactCount(businessId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(contactMessages).where(and(eq(contactMessages.businessId, businessId), isNull(contactMessages.readAt)));
  return r?.n ?? 0;
}
