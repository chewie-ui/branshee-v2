import { index, integer, pgTable, smallint, text, time, date, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { members } from "./team";
import { users } from "./users";

/**
 * App Planning (Skydev) : une plage de travail d'un membre de l'équipe, un jour donné.
 * Fin ≤ début = la plage se termine le lendemain (service du soir, nuit).
 */
export const shifts = pgTable(
  "shifts",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    /** Pause non payée, en minutes. */
    breakMinutes: smallint("break_minutes").notNull().default(0),
    /** Poste ou lieu : « Caisse », « Cuisine », « Chantier Wavre »… */
    label: text("label"),
    note: text("note"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("shifts_business_day_idx").on(t.businessId, t.day), index("shifts_member_day_idx").on(t.memberId, t.day)],
);

/**
 * App Congés (Skydev) : une demande d'absence d'un membre, du `startDate` au `endDate` inclus.
 * Validée, elle ferme les jours concernés dans l'agenda RDV (schedule_exceptions.leave_request_id).
 */
export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** conge | maladie | recup | sans_solde | formation | autre */
    kind: text("kind").notNull().default("conge"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    /** Journée entière, ou demi-journée (matin / après-midi) quand la demande tient sur un seul jour. */
    period: text("period").notNull().default("full"),
    /** pending | approved | refused | cancelled */
    status: text("status").notNull().default("pending"),
    note: text("note"),
    decisionNote: text("decision_note"),
    decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("leave_requests_business_idx").on(t.businessId, t.startDate), index("leave_requests_member_idx").on(t.memberId)],
);

/** Jours de congé par an d'un membre (solde = ce nombre − congés validés de l'année). */
export const leaveAllowances = pgTable(
  "leave_allowances",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    /** En demi-journées pour garder les demi-jours exacts (20 jours = 40). */
    halfDays: integer("half_days").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("leave_allowances_member_year_uq").on(t.memberId, t.year)],
);
