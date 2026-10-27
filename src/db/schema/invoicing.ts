import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { users } from "./users";

/**
 * App Factures (reprise de « Comptoir ») : factures, notes de crédit et devis d'un établissement
 * envers ses propres clients. Rien à voir avec l'abonnement Skydev/Branshee (tables billing).
 */
export const vatRegimeEnum = pgEnum("vat_regime", ["franchise", "assujetti"]);
export const salesDocTypeEnum = pgEnum("sales_doc_type", ["invoice", "credit", "quote"]);
export const salesDocStatusEnum = pgEnum("sales_doc_status", ["draft", "sent", "paid", "cancelled", "accepted", "refused", "invoiced"]);

/** Identité de facturation de l'établissement (mentions obligatoires, IBAN, régime TVA). */
export const invoiceSettings = pgTable("invoice_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  legalName: text("legal_name").notNull().default(""),
  tradeName: text("trade_name").notNull().default(""),
  legalForm: text("legal_form").notNull().default("Personne physique"),
  street: text("street").notNull().default(""),
  zip: text("zip").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default("Belgique"),
  bce: text("bce").notNull().default(""),
  vatNumber: text("vat_number").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  website: text("website").notNull().default(""),
  iban: text("iban").notNull().default(""),
  bic: text("bic").notNull().default(""),
  vatRegime: vatRegimeEnum("vat_regime").notNull().default("franchise"),
  paymentDays: integer("payment_days").notNull().default(15),
  prefix: text("prefix").notNull().default(""),
  defaultNotes: text("default_notes").notNull().default("Merci pour votre confiance."),
  footerNote: text("footer_note").notNull().default(""),
  color: text("color").notNull().default("#4f46e5"),
  ...timestamps,
});

/** Ligne d'un document : prix unitaire en euros (hors TVA si assujetti), TVA en %. */
export type SalesLine = { id: string; desc: string; qty: number; unit: string; price: number; vat: number };
/** Copie figée du vendeur et du client au moment de l'émission (une facture émise ne change plus). */
export type PartySnapshot = Record<string, string | number | undefined>;

export const salesDocuments = pgTable(
  "sales_documents",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    docType: salesDocTypeEnum("doc_type").notNull(),
    status: salesDocStatusEnum("status").notNull().default("draft"),
    /** Numérotation : attribuée à l'émission (factures, notes de crédit) ou à l'enregistrement (devis). */
    year: integer("year"),
    seq: integer("seq"),
    number: text("number"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    client: jsonb("client").$type<PartySnapshot>(),
    seller: jsonb("seller").$type<PartySnapshot>(),
    issueDate: date("issue_date").notNull(),
    serviceDate: date("service_date"),
    dueDate: date("due_date"),
    validUntil: date("valid_until"),
    /** Communication structurée belge (+++123/4567/89012+++). */
    comm: text("comm"),
    notes: text("notes").notNull().default(""),
    lines: jsonb("lines").$type<SalesLine[]>().notNull().default([]),
    htCents: integer("ht_cents").notNull().default(0),
    vatCents: integer("vat_cents").notNull().default(0),
    ttcCents: integer("ttc_cents").notNull().default(0),
    /** Note de crédit → facture d'origine ; devis → facture créée. */
    relatedId: uuid("related_id"),
    appointmentId: uuid("appointment_id"),
    paidDate: date("paid_date"),
    paidMethod: text("paid_method"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("sales_documents_business_idx").on(t.businessId, t.docType, t.issueDate),
    index("sales_documents_customer_idx").on(t.customerId),
    // Numérotation continue : un numéro ne peut exister qu'une fois par type et par année.
    uniqueIndex("sales_documents_number_uq").on(t.businessId, t.docType, t.year, t.seq).where(sql`${t.seq} is not null`),
  ],
);

/** Catalogue de prestations / produits réutilisables dans les documents. */
export const invoiceProducts = pgTable(
  "invoice_products",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("forfait"),
    priceCents: integer("price_cents").notNull().default(0),
    vatRate: integer("vat_rate").notNull().default(21),
    ...timestamps,
  },
  (t) => [index("invoice_products_business_idx").on(t.businessId)],
);
