import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { businesses } from "./businesses";
import { users } from "./users";
import { customers } from "./appointments";

/**
 * Site connecté : clé secrète d'un site sur mesure (API côté serveur). Seule l'empreinte SHA-256
 * est gardée ; la clé complète n'est montrée qu'une fois, à la création.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: text("scopes").array().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash), index("api_keys_business_idx").on(t.businessId)],
);

/** Webhook : Skydev prévient le site (réservation, annulation, commande, message) avec une signature HMAC. */
export const webhooks = pgTable(
  "webhooks",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Secret de signature, chiffré (field-crypto). */
    secret: text("secret").notNull(),
    events: text("events").array().notNull().default([]),
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    lastAt: timestamp("last_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhooks_business_idx").on(t.businessId)],
);

/** Envois de webhooks (avec nouvelles tentatives en cas d'échec). */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    /** pending | sent | failed */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt), index("webhook_deliveries_hook_idx").on(t.webhookId, t.createdAt)],
);

/** Message envoyé depuis le formulaire de contact du site (widget ou API). */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message").notNull(),
    /** widget | api */
    source: text("source").notNull().default("widget"),
    pageUrl: text("page_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_messages_business_idx").on(t.businessId, t.createdAt)],
);
