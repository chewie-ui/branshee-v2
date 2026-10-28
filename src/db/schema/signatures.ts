import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { businesses } from "./businesses";
import { salesDocuments } from "./invoicing";

/**
 * App Signature (Skydev) : demande de signature électronique d'un devis.
 * Signature électronique « simple » au sens eIDAS : nom tapé + tracé, date, adresse IP et empreinte du document signé.
 */
export const quoteSignatures = pgTable(
  "quote_signatures",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => salesDocuments.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    email: text("email").notNull(),
    /** Empreinte SHA-256 du devis au moment de l'envoi (lignes, montants, client, dates). */
    docHash: text("doc_hash").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerName: text("signer_name"),
    signerIp: text("signer_ip"),
    signerAgent: text("signer_agent"),
    /** Tracé de la signature (chemin SVG, coordonnées seulement). */
    signaturePath: text("signature_path"),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("quote_signatures_token_uq").on(t.token), index("quote_signatures_doc_idx").on(t.documentId)],
);
