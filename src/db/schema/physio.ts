import { date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    /** Code de nomenclature par défaut des séances de l'épisode. */
    nomenclature: text("nomenclature"),
    /** Lieu des prestations au sens de la nomenclature (I.a) cabinet, II. domicile…). */
    inamiPlace: text("inami_place").notNull().default("I.a)"),
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
    /** Donnée confidentielle : visible par son auteur seulement, jamais exportée ni partagée. */
    confidential: integer("confidential").notNull().default(0),
    /** Statut Kmehr : 0 = active, 1 = passive (plus en cours mais pertinente pour les décisions). */
    passive: integer("passive").notNull().default(0),
    /** Codes standardisés liés à la donnée (ICF, ICD-10, ICPC-2, SNOMED CT…), texte libre toujours permis. */
    codes: jsonb("codes").$type<{ scheme: string; code: string; label?: string }[]>().notNull().default([]),
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

/**
 * Équipe de soins d'un patient : médecin généraliste, prescripteur, spécialistes, infirmier, aide familiale…
 * role : gp | prescriber | specialist | physio | nurse | care_assistant | home_helper | hospital | coordination | other
 */
export const careTeamMembers = pgTable(
  "care_team_members",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    name: text("name").notNull(),
    profession: text("profession"),
    inami: text("inami"),
    enterpriseNumber: text("enterprise_number"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    iban: text("iban"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_team_customer_idx").on(t.customerId)],
);

/**
 * Documents INAMI d'un patient (rapport au prescripteur, demande de séances supplémentaires, notifications…),
 * générés depuis un modèle puis modifiables. Une fois validé (imprimé ou envoyé), un document est verrouillé :
 * le modifier crée une nouvelle version. `docKey` relie les versions d'un même document.
 */
export const careDocuments = pgTable(
  "care_documents",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id").references(() => careEpisodes.id, { onDelete: "set null" }),
    docKey: uuid("doc_key").notNull(),
    version: integer("version").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    recipientName: text("recipient_name"),
    recipientInami: text("recipient_inami"),
    contentEnc: text("content_enc"),
    /** draft | validated */
    status: text("status").notNull().default("draft"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_documents_customer_idx").on(t.customerId, t.createdAt), uniqueIndex("care_documents_key_version_uq").on(t.docKey, t.version)],
);

/**
 * Mesures de l'examen et du suivi (EVA, amplitudes, force…). Jamais modifiées : une correction ajoute une mesure
 * et marque l'ancienne supprimée (conservée), pour garder l'historique.
 */
export const careMeasures = pgTable(
  "care_measures",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => careEpisodes.id, { onDelete: "cascade" }),
    measureKey: text("measure_key").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    unit: text("unit"),
    /** G | D | null */
    side: text("side"),
    measuredOn: date("measured_on").notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull().default(""),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByName: text("deleted_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_measures_episode_idx").on(t.episodeId, t.measuredOn)],
);

/**
 * Boîte de réception des documents reçus (import manuel PDF / Kmehr, plus tard eHealthBox) : un utilisateur autorisé
 * confirme le patient avant l'intégration au dossier. status : pending | integrated | rejected
 */
export const careInbox = pgTable(
  "care_inbox",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("upload"),
    messageType: text("message_type").notNull().default("document"),
    title: text("title").notNull(),
    senderName: text("sender_name"),
    senderInami: text("sender_inami"),
    docDate: date("doc_date"),
    patientName: text("patient_name"),
    patientBirthDate: date("patient_birth_date"),
    patientNissEnc: text("patient_niss_enc"),
    patientNissHash: text("patient_niss_hash"),
    contentEnc: text("content_enc"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    status: text("status").notNull().default("pending"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    handledByName: text("handled_by_name"),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("care_inbox_business_idx").on(t.businessId, t.status, t.createdAt)],
);
