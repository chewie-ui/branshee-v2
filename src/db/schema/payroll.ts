import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { members } from "./team";
import { users } from "./users";

/** App Paie (Skydev, pré-paie) : contrat d'un membre, pour préparer les prestations du mois. */
export const payrollProfiles = pgTable("payroll_profiles", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  /** Heures par semaine au contrat (en minutes : 38 h = 2280). */
  weeklyMinutes: integer("weekly_minutes").notNull().default(2280),
  /** hourly | monthly */
  payType: text("pay_type").notNull().default("hourly"),
  /** Taux horaire ou salaire mensuel brut (indicatif), en centimes. */
  rateCents: integer("rate_cents").notNull().default(0),
  mealVouchers: boolean("meal_vouchers").notNull().default(false),
  /** Matricule chez le secrétariat social (pour l'export). */
  externalId: text("external_id"),
  ...timestamps,
});

/** Ajustements du mois pour un membre (primes, heures en plus ou en moins, km, remarque). */
export const payrollEntries = pgTable(
  "payroll_entries",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    adjustMinutes: integer("adjust_minutes").notNull().default(0),
    bonusCents: integer("bonus_cents").notNull().default(0),
    km: integer("km").notNull().default(0),
    note: text("note"),
    ...timestamps,
  },
  (t) => [uniqueIndex("payroll_entries_uq").on(t.businessId, t.memberId, t.month)],
);

/** Mois validé (envoyé au secrétariat social) : plus de modification des ajustements. */
export const payrollClosures = pgTable(
  "payroll_closures",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
    closedById: uuid("closed_by_id").references(() => users.id, { onDelete: "set null" }),
    /** Prestations figées à la validation (le contrat ou le planning modifié ensuite ne change plus ce mois). */
    snapshot: jsonb("snapshot").$type<unknown[]>(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.month] })],
);
