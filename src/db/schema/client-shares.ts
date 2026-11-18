import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { customers } from "./appointments";
import { businesses } from "./businesses";

/**
 * Ce que le pro partage avec un client dans son espace (client.skydev.be) : une note (« pensez à ramener votre
 * prescription », exercices à faire) ou un fichier (PDF d'exercices, photo, vidéo). Note chiffrée, fichier privé chiffré.
 * Visible seulement par le compte rattaché à la fiche (email vérifié).
 */
export const clientShares = pgTable(
  "client_shares",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** note | file */
    kind: text("kind").notNull(),
    title: text("title").notNull().default(""),
    bodyEnc: text("body_enc"),
    fileRef: text("file_ref"),
    fileName: text("file_name"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    authorName: text("author_name").notNull().default(""),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_shares_customer_idx").on(t.customerId, t.createdAt), index("client_shares_business_idx").on(t.businessId)],
);
