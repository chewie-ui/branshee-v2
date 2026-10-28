import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { users } from "./users";

/** Demande Sur mesure d'une entreprise (une modif d'app, un outil, une automatisation…). */
export const customRequests = pgTable(
  "custom_requests",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** App concernée (« rdv », « factures »…) ou null pour un nouvel outil. */
    appId: text("app_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** new | quoted | accepted | in_progress | done | declined | cancelled */
    status: text("status").notNull().default("new"),
    /** Prix proposé par Skydev (TVAC, centimes) : mise en place unique et supplément mensuel. */
    setupCents: integer("setup_cents"),
    monthlyCents: integer("monthly_cents"),
    /** Réponse de Skydev visible par le client. */
    reply: text("reply"),
    quotedAt: timestamp("quoted_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("custom_requests_business_idx").on(t.businessId, t.createdAt)],
);

/**
 * Fonctionnalité sur mesure activée pour une seule entreprise. Le code vérifie `hasCustomFeature(businessId, clé)` ;
 * une seule version de Skydev à maintenir, la modif n'apparaît que chez ce client.
 */
export const businessFeatures = pgTable(
  "business_features",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestId: uuid("request_id").references(() => customRequests.id, { onDelete: "set null" }),
    monthlyCents: integer("monthly_cents").notNull().default(0),
    enabledAt: timestamp("enabled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.key] })],
);
