import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";

/** App Commande à table (Skydev) : rubriques de la carte. */
export const menuCategories = pgTable(
  "menu_categories",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("menu_categories_business_idx").on(t.businessId)],
);

/** Plat ou boisson de la carte. */
export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => menuCategories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    /** Allergènes et mentions (« végétarien », « gluten »…). */
    tags: text("tags"),
    photoUrl: text("photo_url"),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("menu_items_business_idx").on(t.businessId)],
);

/** Table du restaurant, avec le jeton de son QR code. */
export const diningTables = pgTable(
  "dining_tables",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    token: text("token").notNull(),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("dining_tables_token_uq").on(t.token), index("dining_tables_business_idx").on(t.businessId)],
);

export type OrderLine = { itemId: string; name: string; priceCents: number; qty: number; note?: string };

/** Commande passée depuis le QR code d'une table. */
export const tableOrders = pgTable(
  "table_orders",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "set null" }),
    tableLabel: text("table_label").notNull(),
    /** Numéro du jour (1, 2, 3…), annoncé au client et en cuisine. */
    number: integer("number").notNull(),
    /** new | preparing | ready | served | cancelled */
    status: text("status").notNull().default("new"),
    lines: jsonb("lines").$type<OrderLine[]>().notNull(),
    totalCents: integer("total_cents").notNull(),
    customerName: text("customer_name"),
    note: text("note"),
    /** Jeton secret remis au client pour suivre sa commande. */
    trackToken: text("track_token").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("table_orders_business_idx").on(t.businessId, t.createdAt), uniqueIndex("table_orders_track_uq").on(t.trackToken)],
);
