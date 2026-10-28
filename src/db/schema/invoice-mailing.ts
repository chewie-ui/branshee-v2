import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { businesses } from "./businesses";
import { salesDocuments } from "./invoicing";

/** Facture envoyée par email depuis Skydev : lien public pour la voir et la payer, relances. */
export const invoiceMailings = pgTable(
  "invoice_mailings",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => salesDocuments.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    /** Relances coupées pour cette facture (accord de paiement, litige…). */
    remindersOff: boolean("reminders_off").notNull().default(false),
  },
  (t) => [uniqueIndex("invoice_mailings_doc_uq").on(t.documentId), uniqueIndex("invoice_mailings_token_uq").on(t.token), index("invoice_mailings_business_idx").on(t.businessId)],
);

/** Relances automatiques des factures échues (réglage de l'entreprise). */
export const invoiceReminderSettings = pgTable("invoice_reminder_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  /** Première relance N jours après l'échéance, puis tous les M jours, au plus X relances. */
  firstDays: integer("first_days").notNull().default(3),
  everyDays: integer("every_days").notNull().default(7),
  maxReminders: integer("max_reminders").notNull().default(3),
});
