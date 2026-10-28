import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";

export type CampaignAudience = { type: "all" | "recent" | "inactive"; days: number };

/** App Marketing (Skydev) : campagne email envoyée aux clients. */
export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    audience: jsonb("audience").$type<CampaignAudience>().notNull(),
    /** draft | sending | sent */
    status: text("status").notNull().default("draft"),
    recipients: integer("recipients").notNull().default(0),
    createdById: uuid("created_by_id").references(() => members.id, { onDelete: "set null" }),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("campaigns_business_idx").on(t.businessId, t.createdAt)],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    firstName: text("first_name"),
    /** Jeton du lien de désabonnement. */
    token: text("token").notNull(),
    /** pending | sent | failed | skipped */
    status: text("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("campaign_recipients_uq").on(t.campaignId, t.email), uniqueIndex("campaign_recipients_token_uq").on(t.token), index("campaign_recipients_pending_idx").on(t.status, t.campaignId)],
);
