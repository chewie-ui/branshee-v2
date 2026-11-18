import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { customers } from "./appointments";
import { businesses } from "./businesses";
import { users } from "./users";

/**
 * Épisode de soins (dossier kiné) : une prescription et la série de séances qui en découle.
 * Statut de pathologie (courante, E, Fa, Fb…), séances prescrites, accord éventuel, clôture.
 */
export const careEpisodes = pgTable(
  "care_episodes",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    prescriberName: text("prescriber_name"),
    prescriberInami: text("prescriber_inami"),
    prescriptionDate: date("prescription_date"),
    sessionsPrescribed: integer("sessions_prescribed"),
    /** courante | E | Fa | Fb | autre */
    pathologyKind: text("pathology_kind").notNull().default("courante"),
    nomenclature: text("nomenclature"),
    approvalStart: date("approval_start"),
    approvalEnd: date("approval_end"),
    /** open | closed */
    status: text("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_episodes_customer_idx").on(t.customerId, t.createdAt), index("care_episodes_business_idx").on(t.businessId)],
);

/**
 * Contenu du dossier kiné, versionné : chaque modification ajoute une version (jamais d'écrasement),
 * avec auteur et date ; une suppression est une version marquée supprimée. `entryKey` relie les versions d'une même donnée.
 * section : anamnese | examen | diagnostic | plan | evaluation | cloture | acte
 */
export const careEntries = pgTable(
  "care_entries",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => careEpisodes.id, { onDelete: "cascade" }),
    entryKey: uuid("entry_key").notNull(),
    section: text("section").notNull(),
    version: integer("version").notNull(),
    contentEnc: text("content_enc"),
    entryDate: date("entry_date"),
    deleted: integer("deleted").notNull().default(0),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_entries_episode_idx").on(t.episodeId, t.section), uniqueIndex("care_entries_key_version_uq").on(t.entryKey, t.version)],
);

/** Journal des accès aux dossiers patients : qui a ouvert quel dossier, quand (exportable). */
export const recordAccessLogs = pgTable(
  "record_access_logs",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name").notNull().default(""),
    /** view | edit | export | print */
    action: text("action").notNull(),
    detail: text("detail"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("record_access_business_idx").on(t.businessId, t.at), index("record_access_customer_idx").on(t.customerId, t.at)],
);
