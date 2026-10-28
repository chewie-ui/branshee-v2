import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";

/** App Boutique (Skydev) : réglages de la boutique en ligne. */
export const shopSettings = pgTable("shop_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  pickup: boolean("pickup").notNull().default(true),
  pickupNote: text("pickup_note"),
  delivery: boolean("delivery").notNull().default(false),
  deliveryCents: integer("delivery_cents").notNull().default(0),
  freeDeliveryFromCents: integer("free_delivery_from_cents"),
  deliveryNote: text("delivery_note"),
  payOnline: boolean("pay_online").notNull().default(false),
  payOnPickup: boolean("pay_on_pickup").notNull().default(true),
  payTransfer: boolean("pay_transfer").notNull().default(false),
  intro: text("intro"),
  ...timestamps,
});

export type ShopLine = { productId: string; name: string; qty: number; unitCents: number; vatRate: number };

/** Commande passée sur la boutique en ligne. */
export const shopOrders = pgTable(
  "shop_orders",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** pending_payment | new | ready | shipped | done | cancelled */
    status: text("status").notNull().default("new"),
    /** online | pickup | transfer */
    payMethod: text("pay_method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** pickup | delivery */
    fulfilment: text("fulfilment").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    address: text("address"),
    note: text("note"),
    lines: jsonb("lines").$type<ShopLine[]>().notNull(),
    itemsCents: integer("items_cents").notNull(),
    deliveryCents: integer("delivery_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    token: text("token").notNull(),
    stripeSessionId: text("stripe_session_id"),
    ...timestamps,
  },
  (t) => [uniqueIndex("shop_orders_number_uq").on(t.businessId, t.number), uniqueIndex("shop_orders_token_uq").on(t.token), index("shop_orders_business_idx").on(t.businessId, t.createdAt)],
);
