import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { members } from "./team";
import { deals } from "./sales";

/** App Ventes › Prospection : une personne ou entreprise à démarcher (liste d'appels). */
export const prospects = pgTable(
  "prospects",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company"),
    phone: text("phone"),
    email: text("email"),
    city: text("city"),
    trade: text("trade"),
    note: text("note"),
    /** todo | no_answer | callback | interested | refused | invalid | do_not_call */
    status: text("status").notNull().default("todo"),
    attempts: integer("attempts").notNull().default(0),
    lastCallAt: timestamp("last_call_at", { withTimezone: true }),
    callbackAt: timestamp("callback_at", { withTimezone: true }),
    refuseReason: text("refuse_reason"),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    ownerMemberId: uuid("owner_member_id").references(() => members.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("prospects_business_status_idx").on(t.businessId, t.status), index("prospects_business_callback_idx").on(t.businessId, t.callbackAt)],
);

/** Chaque appel passé (pour l'historique et les statistiques). */
export const prospectCalls = pgTable(
  "prospect_calls",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    outcome: text("outcome").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prospect_calls_business_idx").on(t.businessId, t.createdAt), index("prospect_calls_prospect_idx").on(t.prospectId, t.createdAt)],
);

/** Script d'appel de l'entreprise (affiché pendant la session d'appels). */
export const prospectScripts = pgTable("prospect_scripts", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  body: text("body").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
