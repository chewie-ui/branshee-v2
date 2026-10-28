import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { appointments, customers } from "./appointments";

/** App Avis Google (Skydev) : réglages de l'établissement. */
export const reviewSettings = pgTable("review_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  /** Lien « Écrire un avis » de la fiche Google (g.page/r/…/review ou search.google.com/local/writereview?placeid=…). */
  googleUrl: text("google_url"),
  /** Demande envoyée automatiquement après chaque rendez-vous terminé. */
  autoSend: boolean("auto_send").notNull().default(false),
  delayHours: integer("delay_hours").notNull().default(2),
  /** Pas plus d'une demande par client sur cette période (jours). */
  minDaysBetween: integer("min_days_between").notNull().default(180),
  message: text("message"),
  /** Jeton du QR code à afficher au comptoir. */
  qrToken: text("qr_token").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("review_settings_qr_uq").on(t.qrToken)]);

/** Une demande d'avis (email, ou passage par le QR code du comptoir). */
export const reviewRequests = pgTable(
  "review_requests",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    /** email | qr */
    channel: text("channel").notNull(),
    email: text("email"),
    name: text("name"),
    token: text("token").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    googleClickedAt: timestamp("google_clicked_at", { withTimezone: true }),
    /** Remarque privée laissée au lieu (ou en plus) d'un avis public. */
    feedbackRating: integer("feedback_rating"),
    feedback: text("feedback"),
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_requests_token_uq").on(t.token), index("review_requests_business_idx").on(t.businessId, t.createdAt), uniqueIndex("review_requests_appointment_uq").on(t.appointmentId)],
);
