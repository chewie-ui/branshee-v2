import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";

/** App Fidélité (Skydev) : réglages du programme (tampons par passage). */
export const loyaltySettings = pgTable("loyalty_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  /** Nombre de tampons pour obtenir la récompense. */
  goal: integer("goal").notNull().default(10),
  reward: text("reward").notNull().default("Une prestation offerte"),
  ...timestamps,
});

/** Carte de fidélité d'un client (solde de tampons, lien public pour la voir sur son téléphone). */
export const loyaltyCards = pgTable(
  "loyalty_cards",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    stamps: integer("stamps").notNull().default(0),
    rewardsEarned: integer("rewards_earned").notNull().default(0),
    token: text("token").notNull(),
    lastStampAt: timestamp("last_stamp_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("loyalty_cards_customer_uq").on(t.businessId, t.customerId), uniqueIndex("loyalty_cards_token_uq").on(t.token)],
);

export const loyaltyMoves = pgTable(
  "loyalty_moves",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => loyaltyCards.id, { onDelete: "cascade" }),
    /** +1 (passage), −goal (récompense utilisée), ou correction. */
    delta: integer("delta").notNull(),
    /** stamp | reward | fix */
    kind: text("kind").notNull(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loyalty_moves_card_idx").on(t.cardId, t.createdAt)],
);

/** Carte cadeau vendue (montant, solde, validité). */
export const giftCards = pgTable(
  "gift_cards",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    initialCents: integer("initial_cents").notNull(),
    balanceCents: integer("balance_cents").notNull(),
    buyerName: text("buyer_name"),
    recipientName: text("recipient_name"),
    message: text("message"),
    expiresOn: date("expires_on").notNull(),
    createdById: uuid("created_by_id").references(() => members.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("gift_cards_code_uq").on(t.businessId, t.code), index("gift_cards_business_idx").on(t.businessId, t.createdAt)],
);

export const giftCardUses = pgTable(
  "gift_card_uses",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    giftCardId: uuid("gift_card_id")
      .notNull()
      .references(() => giftCards.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gift_card_uses_card_idx").on(t.giftCardId)],
);
