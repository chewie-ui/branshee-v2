import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, legacyId, timestamps } from "./_shared";
import { users } from "./users";

export const locationModeEnum = pgEnum("location_mode", ["on_site", "online", "embed"]);
export const scheduleModeEnum = pgEnum("schedule_mode", ["shared", "per_member"]);
export const slotModeEnum = pgEnum("slot_mode", ["fixed", "interval"]);
export const cancellationRuleEnum = pgEnum("cancellation_rule", ["free", "half_24h", "full_12h"]);
export const stripeConnectStatusEnum = pgEnum("stripe_connect_status", ["not_connected", "pending", "active"]);

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  tiktok?: string;
  linkedin?: string;
  youtube?: string;
};

/**
 * Établissement (cabinet, salon, studio…).
 * Remplace à la fois `Company` et toutes les infos « business » qui étaient
 * dupliquées dans `User` dans l'ancien code.
 */
export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    businessType: text("business_type"),
    photoUrl: text("photo_url"),
    description: text("description"),
    aboutHtml: text("about_html"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    social: jsonb("social").$type<SocialLinks>().notNull().default({}),

    locationMode: locationModeEnum("location_mode").notNull().default("on_site"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    mapEmbedUrl: text("map_embed_url"),
    /** Lien « Ouvrir dans Maps » choisi par le pro (sinon calculé depuis l'adresse). */
    mapsUrl: text("maps_url"),
    /** Langues parlées (codes ISO 639-1), surtout utile pour les consultations en ligne. */
    languages: text("languages").array().notNull().default([]),
    timezone: text("timezone").notNull().default("Europe/Brussels"),

    pausedAt: timestamp("paused_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Position dans l'annuaire public (mise en avant décidée par le super-admin). */
    boostPosition: integer("boost_position").notNull().default(0),
    /** Checklist « Bien démarrer » : lien partagé, checklist masquée. */
    onboarding: jsonb("onboarding").$type<{ linkSharedAt?: string; dismissedAt?: string }>().notNull().default({}),

    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [index("businesses_owner_idx").on(t.ownerId), index("businesses_city_type_idx").on(t.city, t.businessType)],
);

/** Règles de réservation — tout ce qui décide quels créneaux sont proposés. */
export const bookingSettings = pgTable("booking_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  scheduleMode: scheduleModeEnum("schedule_mode").notNull().default("shared"),
  slotMode: slotModeEnum("slot_mode").notNull().default("fixed"),
  /** Pas entre deux créneaux proposés, en minutes. */
  slotIntervalMin: integer("slot_interval_min").notNull().default(30),
  bufferBeforeMin: integer("buffer_before_min").notNull().default(0),
  bufferAfterMin: integer("buffer_after_min").notNull().default(0),
  /** Délai minimum avant un RDV (null = aucun). */
  minLeadMin: integer("min_lead_min"),
  /** Réservable jusqu'à N jours à l'avance (null = illimité). */
  horizonDays: integer("horizon_days"),
  autoConfirm: boolean("auto_confirm").notNull().default(true),
  waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
  allowOverbooking: boolean("allow_overbooking").notNull().default(false),
  phoneRequired: boolean("phone_required").notNull().default(true),
  /** Regroupement intelligent : ne proposer que les créneaux proches des RDV existants. */
  smartGrouping: jsonb("smart_grouping")
    .$type<{ enabled: boolean; windowHours: number; weekdays: number[] }>()
    .notNull()
    .default({ enabled: false, windowHours: 3, weekdays: [] }),
  /** Question « première visite ? » posée avant le choix de la prestation. */
  firstVisitQuestion: jsonb("first_visit_question")
    .$type<{ enabled: boolean; question: string; newLabel: string; existingLabel: string }>()
    .notNull()
    .default({
      enabled: false,
      question: "Est-ce la première fois que vous nous consultez ?",
      newLabel: "Oui, je suis nouveau",
      existingLabel: "Non, j’ai déjà consulté",
    }),
  ...timestamps,
});

export type AcceptedPayments = {
  cash: boolean;
  cardOnSite: boolean;
  bankTransfer: { enabled: boolean; iban?: string; bic?: string; bankName?: string; note?: string };
  paypal: { enabled: boolean; paypalMe?: string };
  qrCode: { enabled: boolean; imageUrl?: string; note?: string };
};

/** Encaissement des clients de l'établissement. */
export const paymentSettings = pgTable("payment_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  prepaymentEnabled: boolean("prepayment_enabled").notNull().default(false),
  prepaymentRequired: boolean("prepayment_required").notNull().default(false),
  cancellationRule: cancellationRuleEnum("cancellation_rule").notNull().default("free"),
  stripeAccountId: text("stripe_account_id"),
  stripeStatus: stripeConnectStatusEnum("stripe_status").notNull().default("not_connected"),
  stripeAccountEmail: text("stripe_account_email"),
  accepted: jsonb("accepted")
    .$type<AcceptedPayments>()
    .notNull()
    .default({
      cash: false,
      cardOnSite: false,
      bankTransfer: { enabled: false },
      paypal: { enabled: false },
      qrCode: { enabled: false },
    }),
  /** Reversement des paiements encaissés par Branshee quand le pro n'a pas de compte Stripe Connect. */
  payout: jsonb("payout").$type<{ method?: "bank_transfer" | "paypal" | "cash" | "other"; iban?: string; bic?: string; paypalEmail?: string; other?: string }>().notNull().default({}),
  ...timestamps,
});

/** Emails / SMS / WhatsApp envoyés aux clients et au pro. */
export const notificationSettings = pgTable("notification_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  reminderDelayHours: integer("reminder_delay_hours").notNull().default(24),
  reminderMessage: text("reminder_message"),
  confirmationMessage: text("confirmation_message"),
  cancellationMessage: text("cancellation_message"),
  reminderPaymentMethods: text("reminder_payment_methods").array().notNull().default([]),
  reminderPaymentNote: text("reminder_payment_note"),
  emailOwnerOnNewBooking: boolean("email_owner_on_new_booking").notNull().default(true),
  emailOwnerOnCancellation: boolean("email_owner_on_cancellation").notNull().default(true),
  smsReminders: boolean("sms_reminders").notNull().default(false),
  smsConfirmations: boolean("sms_confirmations").notNull().default(false),
  smsAllowOverage: boolean("sms_allow_overage").notNull().default(false),
  whatsappReminders: boolean("whatsapp_reminders").notNull().default(false),
  whatsappConfirmations: boolean("whatsapp_confirmations").notNull().default(false),
  ...timestamps,
});

/**
 * Apparence de la page de réservation. Les champs facultatifs absents = valeur par défaut
 * (voir `src/lib/booking-theme.ts`, qui les complète et les valide).
 */
export type BookingTheme = {
  accentColor: string;
  accentText: string;
  pageBg: string;
  pageBgImage?: string;
  /** Fond des cartes (calendrier, infos). */
  calBg?: string;
  textColor?: string;
  dayBg?: string;
  daySelectedBg?: string;
  daySelectedText?: string;
  dayHoverBg?: string;
  btnHoverBg?: string;
  dayAvailableColor?: string;
  dayBusyColor?: string;
  dayFullColor?: string;
  font: string;
  customFontUrl?: string;
  customFontFamily?: string;
  radius: "none" | "sm" | "md" | "lg";
  borderStyle?: "none" | "subtle" | "medium" | "strong";
  shadowStyle?: "none" | "subtle" | "medium" | "strong";
  layout: "classic" | "split";
  /** Textes personnalisés du parcours de réservation. */
  texts?: { calendarHelp?: string; slotHeading?: string; timezone?: string };
};

export type PageSection = "about" | "services" | "team" | "reviews" | "amenities" | "faq" | "gallery" | "location" | "hours";

/** Apparence de la page publique de réservation (ex-`calendarSettings`). */
export const bookingPageSettings = pgTable("booking_page_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  theme: jsonb("theme").$type<BookingTheme>().notNull().default({ accentColor: "#4f46e5", accentText: "#ffffff", pageBg: "#f7f7f8", font: "Inter", radius: "md", layout: "classic" }),
  /** Sections affichées, dans l'ordre. */
  sections: jsonb("sections").$type<PageSection[]>().notNull().default(["about", "services", "location", "hours"]),
  showContact: jsonb("show_contact")
    .$type<{ email: boolean; phone: boolean; instagram: boolean; facebook: boolean; whatsapp: boolean; website: boolean }>()
    .notNull()
    .default({ email: true, phone: true, instagram: true, facebook: true, whatsapp: true, website: true }),
  gallery: text("gallery").array().notNull().default([]),
  galleryLayout: text("gallery_layout", { enum: ["grid", "mosaic", "carousel"] }).notNull().default("grid"),
  equipment: text("equipment").array().notNull().default([]),
  amenities: jsonb("amenities")
    .$type<{ cleanliness: string[]; comfort: string[]; practical: string[] }>()
    .notNull()
    .default({ cleanliness: [], comfort: [], practical: [] }),
  faq: jsonb("faq").$type<{ question: string; answer: string }[]>().notNull().default([]),
  badges: text("badges").array().notNull().default([]),
  categoryStyle: text("category_style", { enum: ["pills", "accordion", "grid"] }).notNull().default("pills"),
  embed: jsonb("embed").$type<{ title?: string; fontUrl?: string; fontFamily?: string }>().notNull().default({}),
  ...timestamps,
});

/** Catégories de prestations (avec icône). */
export const serviceCategories = pgTable(
  "service_categories",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("service_categories_business_name_uq").on(t.businessId, t.name)],
);

/** Journal d'activité : qui a fait quoi dans l'établissement. */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    description: text("description").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("activity_logs_business_idx").on(t.businessId, t.createdAt)],
);
