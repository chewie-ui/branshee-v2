import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { id, legacyId, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { groupSessions, services } from "./services";
import { members } from "./team";
import { users } from "./users";

export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "cancelled"]);
export const appointmentKindEnum = pgEnum("appointment_kind", ["appointment", "block"]);
export const noShowReasonEnum = pgEnum("no_show_reason", ["justified", "unjustified"]);
export const paymentMethodEnum = pgEnum("payment_method", ["online", "on_site", "bank_transfer", "paypal", "cash", "none"]);
export const paymentStatusEnum = pgEnum("payment_status", ["none", "authorized", "paid", "refunded", "partial", "penalty", "failed"]);

/**
 * Fiche client d'un établissement.
 * Un client peut exister sans compte (créé à la main ou réservation sans inscription) ;
 * `userId` relie la fiche à son compte quand il en a un.
 */
export const customers = pgTable(
  "customers",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    altName: text("alt_name"),
    altEmail: text("alt_email"),
    altPhone: text("alt_phone"),
    /** Informations générales du dossier — chiffrées côté application. */
    generalInfoEnc: text("general_info_enc"),
    createdManually: boolean("created_manually").notNull().default(false),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customers_business_email_uq").on(t.businessId, sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    index("customers_business_name_idx").on(t.businessId, t.fullName),
    index("customers_user_idx").on(t.userId),
  ],
);

/** Entrée datée du dossier client (note, à faire, pièce jointe) — contenu chiffré. */
export const customerNotes = pgTable(
  "customer_notes",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id").references(() => members.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    title: text("title"),
    noteEnc: text("note_enc"),
    todoEnc: text("todo_enc"),
    attachmentPath: text("attachment_path"),
    attachmentName: text("attachment_name"),
    attachmentSize: integer("attachment_size"),
    ...timestamps,
  },
  (t) => [index("customer_notes_customer_idx").on(t.customerId, t.date)],
);

/**
 * Rendez-vous ou créneau bloqué.
 * Les chevauchements sont interdits PAR LA BASE pour un même membre
 * (contrainte d'exclusion dans drizzle/custom/0001_constraints.sql).
 */
export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: appointmentKindEnum("kind").notNull().default("appointment"),
    status: appointmentStatusEnum("status").notNull().default("confirmed"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    groupSessionId: uuid("group_session_id").references(() => groupSessions.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),

    /** Copies figées au moment de la réservation (restent lisibles si la prestation change). */
    serviceName: text("service_name"),
    serviceColor: text("service_color"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    customerMessage: text("customer_message"),
    formAnswers: jsonb("form_answers").$type<{ question: string; answer: string }[]>().notNull().default([]),

    internalNote: text("internal_note"),
    overbooked: boolean("overbooked").notNull().default(false),
    noShow: boolean("no_show").notNull().default(false),
    noShowReason: noShowReasonEnum("no_show_reason"),

    /** Jeton secret des liens « annuler / reprogrammer » envoyés au client. */
    manageToken: text("manage_token")
      .notNull()
      .unique()
      .$defaultFn(() => randomBytes(32).toString("hex")),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    manualReminderSentAt: timestamp("manual_reminder_sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    googleEventId: text("google_event_id"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),

    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [
    index("appointments_agenda_idx").on(t.businessId, t.startsAt),
    index("appointments_member_idx").on(t.memberId, t.startsAt),
    index("appointments_customer_idx").on(t.customerId),
    index("appointments_reminder_idx").on(t.startsAt).where(sql`${t.status} = 'confirmed' and ${t.reminderSentAt} is null`),
    check("appointments_order_ck", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

/** Paiement lié à un rendez-vous (une ligne par RDV payant). */
export const appointmentPayments = pgTable("appointment_payments", {
  appointmentId: uuid("appointment_id")
    .primaryKey()
    .references(() => appointments.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull().default("none"),
  status: paymentStatusEnum("status").notNull().default("none"),
  amountCents: integer("amount_cents").notNull().default(0),
  penaltyCents: integer("penalty_cents").notNull().default(0),
  keptCents: integer("kept_cents").notNull().default(0),
  currency: text("currency").notNull().default("eur"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSetupIntentId: text("stripe_setup_intent_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancellationDecision: text("cancellation_decision", { enum: ["refunded", "kept"] }),
  cancellationReviewedAt: timestamp("cancellation_reviewed_at", { withTimezone: true }),
  ...timestamps,
});

/** Avis laissé par un client sur un établissement. */
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_business_user_uq").on(t.businessId, t.userId),
    check("reviews_rating_ck", sql`${t.rating} between 1 and 5`),
  ],
);

export const reviewReports = pgTable(
  "review_reports",
  {
    id: id(),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "set null" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    reporterKind: text("reporter_kind", { enum: ["visitor", "user", "owner"] }).notNull(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    reporterFingerprint: text("reporter_fingerprint"),
    reason: text("reason", { enum: ["insulting", "false", "spam", "personal", "other"] }).notNull(),
    message: text("message"),
    /** Copie de l'avis au moment du signalement (reste consultable s'il est supprimé). */
    snapshot: jsonb("snapshot").$type<{ authorName: string; rating: number; comment: string | null; createdAt: string }>().notNull(),
    status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    ...timestamps,
  },
  (t) => [index("review_reports_status_idx").on(t.status)],
);

/**
 * Liste d'attente : un client demande à être prévenu si une place se libère un jour donné
 * (pour une prestation, éventuellement avec un praticien). Prévenu une seule fois.
 */
export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("waitlist_lookup_idx").on(t.businessId, t.date),
    uniqueIndex("waitlist_unique_uq").on(t.businessId, t.date, t.email, t.serviceId),
  ],
);
