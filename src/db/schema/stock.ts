import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";

/** Apps Stock et Caisse (Skydev) : un produit vendu ou suivi en stock. */
export const products = pgTable(
  "products",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    category: text("category"),
    /** Prix de vente TVAC (ce que paie le client à la caisse). */
    priceCents: integer("price_cents").notNull().default(0),
    vatRate: integer("vat_rate").notNull().default(21),
    /** Prix d'achat HTVA (valeur du stock, marge). */
    costCents: integer("cost_cents"),
    trackStock: boolean("track_stock").notNull().default(true),
    stockQty: integer("stock_qty").notNull().default(0),
    minQty: integer("min_qty"),
    supplier: text("supplier"),
    photoUrl: text("photo_url"),
    active: boolean("active").notNull().default(true),
    /** App Boutique : produit visible dans la boutique en ligne, avec sa description. */
    onlineEnabled: boolean("online_enabled").notNull().default(false),
    description: text("description"),
    /**
     * Tailles et couleurs : un « modèle » (isModel, jamais vendu tel quel) et ses déclinaisons
     * (parentId = le modèle), chacune avec son stock, son code-barres et sa ligne de ticket.
     */
    isModel: boolean("is_model").notNull().default(false),
    parentId: uuid("parent_id").references((): AnyPgColumn => products.id, { onDelete: "cascade" }),
    size: text("size"),
    color: text("color"),
    sizeGrid: text("size_grid"),
    /** Alerte « stock bas » déjà envoyée (remise à zéro au réassort). */
    lowNotifiedAt: timestamp("low_notified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("products_business_idx").on(t.businessId, t.active), index("products_parent_idx").on(t.parentId), uniqueIndex("products_business_barcode_uq").on(t.businessId, t.barcode).where(sql`${t.barcode} is not null`)],
);

/** Entrée ou sortie de stock (réception, vente, casse, inventaire…). */
export const stockMoves = pgTable(
  "stock_moves",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    /** in | out | sale | refund | count */
    reason: text("reason").notNull(),
    note: text("note"),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    saleId: uuid("sale_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_moves_business_idx").on(t.businessId, t.createdAt), index("stock_moves_product_idx").on(t.productId, t.createdAt)],
);

/** Ouverture et clôture de caisse (fond de caisse, comptage). */
export const posSessions = pgTable(
  "pos_sessions",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    openedById: uuid("opened_by_id").references(() => members.id, { onDelete: "set null" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    openingCashCents: integer("opening_cash_cents").notNull().default(0),
    closedById: uuid("closed_by_id").references(() => members.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    countedCashCents: integer("counted_cash_cents"),
    expectedCashCents: integer("expected_cash_cents"),
    note: text("note"),
    /** Totaux figés à la clôture (le rapport Z ne change plus ensuite). */
    totals: jsonb("totals").$type<Record<string, number>>(),
  },
  (t) => [index("pos_sessions_business_idx").on(t.businessId, t.openedAt), uniqueIndex("pos_sessions_one_open_uq").on(t.businessId).where(sql`${t.closedAt} is null`)],
);

export type PosLine = { productId: string | null; name: string; qty: number; unitCents: number; vatRate: number };

/** Ticket de caisse. */
export const posSales = pgTable(
  "pos_sales",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => posSessions.id, { onDelete: "set null" }),
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),
    number: text("number").notNull(),
    lines: jsonb("lines").$type<PosLine[]>().notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    vatCents: integer("vat_cents").notNull(),
    /** cash | card | other */
    method: text("method").notNull(),
    cashGivenCents: integer("cash_given_cents"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    /** paid | refunded */
    status: text("status").notNull().default("paid"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    /** Session de caisse pendant laquelle le remboursement a eu lieu (l'argent sort de ce tiroir-là). */
    refundSessionId: uuid("refund_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pos_sales_number_uq").on(t.businessId, t.year, t.seq), index("pos_sales_business_idx").on(t.businessId, t.createdAt), index("pos_sales_session_idx").on(t.sessionId)],
);
