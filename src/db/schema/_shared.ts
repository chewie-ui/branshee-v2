import { timestamp, uuid, text } from "drizzle-orm/pg-core";

/** Identifiant primaire : UUID v4 généré par Postgres. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** Dates de création / mise à jour, présentes sur presque toutes les tables. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Identifiant MongoDB d'origine (ObjectId en hexadécimal).
 * Sert uniquement à la migration depuis l'ancien Branshee : on peut retrouver
 * et relier chaque ligne à son document source, et relancer le script sans doublons.
 */
export const legacyId = () => text("legacy_id").unique();

/** Plage horaire dans une journée, au format "HH:MM". */
export type TimeRange = { start: string; end: string };
