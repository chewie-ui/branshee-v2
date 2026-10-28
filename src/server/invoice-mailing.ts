import "server-only";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, invoiceMailings, invoiceReminderSettings, salesDocuments } from "@/db/schema";
import { DEFAULT_RULE, reminderDue, type ReminderRule } from "@/lib/invoice-reminders";
import { todayIn } from "@/lib/planning";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { signOrigin } from "@/server/signatures";

export const invoiceUrl = (token: string) => `${signOrigin()}/facture/${token}`;
export const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);
export const longDate = (iso: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", dateStyle: "long" }).format(new Date(`${iso}T12:00:00Z`));

export async function mailingOf(businessId: string, documentId: string) {
  const [m] = await db.select().from(invoiceMailings).where(and(eq(invoiceMailings.businessId, businessId), eq(invoiceMailings.documentId, documentId)));
  return m ?? null;
}

export async function reminderRuleOf(businessId: string): Promise<ReminderRule & { enabled: boolean }> {
  const [s] = await db.select().from(invoiceReminderSettings).where(eq(invoiceReminderSettings.businessId, businessId));
  return s ? { enabled: s.enabled, firstDays: s.firstDays, everyDays: s.everyDays, maxReminders: s.maxReminders } : { enabled: false, ...DEFAULT_RULE };
}

/** Page publique : la facture émise derrière un lien (jamais un brouillon, jamais un devis). */
export async function invoiceByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const [r] = await db
    .select({ m: invoiceMailings, d: salesDocuments, business: businesses.name })
    .from(invoiceMailings)
    .innerJoin(salesDocuments, eq(salesDocuments.id, invoiceMailings.documentId))
    .innerJoin(businesses, eq(businesses.id, invoiceMailings.businessId))
    .where(and(eq(invoiceMailings.token, token), isNull(businesses.deletedAt)));
  if (!r || r.d.status === "draft" || !r.d.number || (r.d.docType !== "invoice" && r.d.docType !== "credit")) return null;
  return r;
}

/**
 * Tâche quotidienne : relance les factures échues envoyées depuis Skydev, selon le réglage de chaque entreprise.
 * La réservation (remindersSent = valeur lue) empêche deux passages simultanés d'envoyer deux fois.
 */
export async function sendInvoiceReminders() {
  const rows = await db
    .select({ m: invoiceMailings, d: salesDocuments, s: invoiceReminderSettings, tz: businesses.timezone, biz: businesses.name })
    .from(invoiceMailings)
    .innerJoin(salesDocuments, eq(salesDocuments.id, invoiceMailings.documentId))
    .innerJoin(invoiceReminderSettings, eq(invoiceReminderSettings.businessId, invoiceMailings.businessId))
    .innerJoin(businesses, eq(businesses.id, invoiceMailings.businessId))
    .where(
      and(
        eq(invoiceReminderSettings.enabled, true),
        eq(invoiceMailings.remindersOff, false),
        lt(invoiceMailings.remindersSent, invoiceReminderSettings.maxReminders),
        eq(salesDocuments.docType, "invoice"),
        eq(salesDocuments.status, "sent"),
        isNotNull(salesDocuments.dueDate),
        // Échéance assez dépassée (le détail jour par jour, fuseau compris, est vérifié plus bas).
        sql`${salesDocuments.dueDate} + ${invoiceReminderSettings.firstDays} <= current_date + 1`,
        // Une note de crédit (même partielle) change le montant dû : plus de relance automatique, le responsable décide.
        sql`not exists (select 1 from "sales_documents" c where c.related_id = "sales_documents"."id" and c.doc_type = 'credit' and c.number is not null)`,
        isNull(businesses.deletedAt),
      ),
    )
    .orderBy(sql`${invoiceMailings.lastReminderAt} asc nulls first`)
    .limit(2000);
  let sent = 0;
  for (const r of rows) {
    const tz = r.tz || "Europe/Brussels";
    const today = todayIn(tz);
    const lastDay = r.m.lastReminderAt ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(r.m.lastReminderAt) : null;
    if (!reminderDue({ dueDate: r.d.dueDate, remindersSent: r.m.remindersSent, lastReminderDay: lastDay }, r.s, today)) continue;
    const claimed = await db
      .update(invoiceMailings)
      .set({ remindersSent: sql`${invoiceMailings.remindersSent} + 1`, lastReminderAt: new Date() })
      .where(and(eq(invoiceMailings.id, r.m.id), eq(invoiceMailings.remindersSent, r.m.remindersSent), eq(invoiceMailings.remindersOff, false), sql`exists (select 1 from "sales_documents" s where s.id = ${invoiceMailings.documentId} and s.status = 'sent')`))
      .returning({ id: invoiceMailings.id });
    if (!claimed.length) continue;
    const seller = String(r.d.seller?.tradeName || r.d.seller?.legalName || r.biz);
    const ok = await sendEmail({
      to: r.m.email,
      ...emails.invoiceReminder({ sellerName: seller, number: r.d.number ?? "", amount: eur(r.d.ttcCents), due: longDate(r.d.dueDate!), url: invoiceUrl(r.m.token), nth: r.m.remindersSent + 1 }),
      template: "invoice_reminder",
      businessId: r.d.businessId,
      replyTo: String(r.d.seller?.email || "") || null,
    }).catch(() => false);
    // Email refusé : la relance est rendue pour réessayer demain.
    if (!ok) await db.update(invoiceMailings).set({ remindersSent: r.m.remindersSent, lastReminderAt: r.m.lastReminderAt }).where(eq(invoiceMailings.id, r.m.id));
    else sent++;
  }
  return sent;
}
