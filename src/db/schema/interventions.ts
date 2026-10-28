import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";

export type InterventionItem = { name: string; qty: number; unitCents: number; vatRate: number };
export type InterventionPhoto = { ref: string; kind: "before" | "after"; at: string; name: string };

/** App Interventions (Skydev) : bon d'intervention d'un technicien chez un client. */
export const interventions = pgTable(
  "interventions",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    clientEmail: text("client_email"),
    address: text("address"),
    title: text("title").notNull(),
    description: text("description"),
    technicianId: uuid("technician_id").references(() => members.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    /** planned | onroute | working | done | cancelled */
    status: text("status").notNull().default("planned"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    report: text("report"),
    items: jsonb("items").$type<InterventionItem[]>().notNull().default([]),
    laborMinutes: integer("labor_minutes"),
    photos: jsonb("photos").$type<InterventionPhoto[]>().notNull().default([]),
    signerName: text("signer_name"),
    signaturePath: text("signature_path"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    invoiceId: uuid("invoice_id"),
    ...timestamps,
  },
  (t) => [index("interventions_business_idx").on(t.businessId, t.scheduledAt), index("interventions_tech_idx").on(t.technicianId, t.scheduledAt)],
);
