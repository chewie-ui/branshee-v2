import { date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";

/** App Ventes (Skydev) : une piste commerciale, du premier contact à la signature. */
export const deals = pgTable(
  "deals",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    contactName: text("contact_name"),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    valueCents: integer("value_cents").notNull().default(0),
    /** lead | contacted | quote | negotiation | won | lost */
    stage: text("stage").notNull().default("lead"),
    source: text("source"),
    ownerMemberId: uuid("owner_member_id").references(() => members.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** Devis créé depuis la piste (app Factures). */
    quoteId: uuid("quote_id"),
    nextActionDate: date("next_action_date"),
    nextAction: text("next_action"),
    expectedClose: date("expected_close"),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("deals_business_stage_idx").on(t.businessId, t.stage), index("deals_business_next_idx").on(t.businessId, t.nextActionDate)],
);

/** Historique d'une piste : notes, appels, emails, changements d'étape. */
export const dealActivities = pgTable(
  "deal_activities",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    /** note | call | email | meeting | stage */
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deal_activities_deal_idx").on(t.dealId, t.createdAt)],
);
