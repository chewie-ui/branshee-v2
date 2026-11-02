import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";

/** App Véhicules (garages, négociants) : un véhicule en vente, avec sa fiche technique et ses photos. */
export const vehicles = pgTable(
  "vehicles",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** draft (brouillon, invisible) · for_sale · reserved · sold */
    status: text("status").notNull().default("draft"),
    /** Adresse publique : /vehicules/<slug de l'entreprise>/<slug>. */
    slug: text("slug").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    version: text("version"),
    bodyType: text("body_type"),
    fuel: text("fuel"),
    gearbox: text("gearbox"),
    /** Mois de première immatriculation « AAAA-MM ». */
    firstRegistration: text("first_registration"),
    mileageKm: integer("mileage_km"),
    powerKw: integer("power_kw"),
    engineCc: integer("engine_cc"),
    co2: integer("co2"),
    euroNorm: text("euro_norm"),
    color: text("color"),
    interior: text("interior"),
    doors: integer("doors"),
    seats: integer("seats"),
    owners: integer("owners"),
    /** Prix affiché TVAC (null = « prix sur demande »). */
    priceCents: integer("price_cents"),
    /** margin (régime de la marge, TVA non récupérable) · vat (TVA déductible pour un professionnel). */
    vatMode: text("vat_mode").notNull().default("margin"),
    warrantyMonths: integer("warranty_months"),
    carPass: boolean("car_pass").notNull().default(true),
    serviceHistory: boolean("service_history").notNull().default(false),
    /** Équipements et options, un par élément. */
    equipment: text("equipment").array().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    /** Photos publiques (URL /media/…), dans l'ordre d'affichage : la première est la photo principale. */
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
    /** Informations internes, jamais affichées au public. */
    vin: text("vin"),
    plate: text("plate"),
    purchaseCents: integer("purchase_cents"),
    internalNote: text("internal_note"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("vehicles_business_slug_uq").on(t.businessId, t.slug), index("vehicles_business_status_idx").on(t.businessId, t.status)],
);
