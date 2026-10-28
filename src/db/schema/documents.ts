import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";
import { projects } from "./projects";

/** App Documents (Skydev) : dossiers partagés de l'équipe (imbriquables). */
export const docFolders = pgTable(
  "doc_folders",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => docFolders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("doc_folders_business_idx").on(t.businessId, t.parentId)],
);

/** Fichier (chiffré sur le serveur), éventuellement partagé par lien. */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => docFolders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    fileRef: text("file_ref").notNull(),
    uploadedById: uuid("uploaded_by_id").references(() => members.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    shareToken: text("share_token"),
    shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_business_idx").on(t.businessId, t.folderId), uniqueIndex("documents_share_uq").on(t.shareToken), index("documents_customer_idx").on(t.customerId)],
);
