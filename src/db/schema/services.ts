import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid, jsonb, check, smallint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, legacyId, timestamps } from "./_shared";
import { businesses, serviceCategories } from "./businesses";
import { members } from "./team";

export const serviceKindEnum = pgEnum("service_kind", ["individual", "group"]);
export const feeTypeEnum = pgEnum("fee_type", ["percent", "amount"]);
export const audienceEnum = pgEnum("audience", ["all", "new", "existing"]);
export const formQuestionTypeEnum = pgEnum("form_question_type", ["text", "choice", "yes_no"]);

export const services = pgTable(
  "services",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Prix en centimes (null = prix non affiché). */
    priceCents: integer("price_cents"),
    durationMin: integer("duration_min").notNull().default(30),
    /** Si défini, la durée est une plage « de durationMin à durationMaxMin ». */
    durationMaxMin: integer("duration_max_min"),
    kind: serviceKindEnum("kind").notNull().default("individual"),
    capacity: integer("capacity"),
    color: text("color"),
    imageUrl: text("image_url"),
    location: text("location"),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Qui voit cette prestation selon la réponse à « première visite ? ». */
    audience: audienceEnum("audience").notNull().default("all"),
    cancellationFeeType: feeTypeEnum("cancellation_fee_type"),
    cancellationFeeValue: integer("cancellation_fee_value"),
    /** Cours collectif récurrent : jours de la semaine + heure de début. */
    recurrence: jsonb("recurrence").$type<{ weekdays: number[]; startTime: string } | null>(),
    /** Une séance collective bloque les RDV individuels sur le même créneau. */
    blocksIndividual: boolean("blocks_individual").notNull().default(true),
    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [
    index("services_business_idx").on(t.businessId, t.position),
    check("services_duration_ck", sql`${t.durationMin} > 0 and (${t.durationMaxMin} is null or ${t.durationMaxMin} >= ${t.durationMin})`),
  ],
);

/** Membres qui réalisent une prestation (aucune ligne = tous les membres réservables). */
export const serviceMembers = pgTable(
  "service_members",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.memberId] })],
);

/** Séance d'un cours collectif (ponctuelle ou générée depuis la récurrence). */
export const groupSessions = pgTable(
  "group_sessions",
  {
    id: id(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("group_sessions_service_idx").on(t.serviceId, t.startsAt)],
);

/** Questions du formulaire posé avant chaque réservation. */
export const formQuestions = pgTable(
  "form_questions",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    type: formQuestionTypeEnum("type").notNull().default("text"),
    isRequired: boolean("is_required").notNull().default(false),
    options: text("options").array().notNull().default([]),
    position: smallint("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("form_questions_business_idx").on(t.businessId)],
);

/**
 * Questionnaire d'orientation : chaque réponse restreint les prestations proposées.
 * (ex-`serviceQuestionnaire` + `questionRules`)
 */
export const intakeQuestions = pgTable("intake_questions", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  position: smallint("position").notNull().default(0),
  ...timestamps,
});

export const intakeOptions = pgTable("intake_options", {
  id: id(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => intakeQuestions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: smallint("position").notNull().default(0),
});

/** Une prestation n'apparaît que si l'une des options liées a été choisie. */
export const serviceIntakeRules = pgTable(
  "service_intake_rules",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => intakeOptions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.optionId] })],
);
