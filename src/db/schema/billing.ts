import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, legacyId, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { users } from "./users";

export const planEnum = pgEnum("plan", ["free", "pro", "pro_plus"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "trialing", "past_due", "cancelled", "expired"]);

/**
 * Abonnement Branshee d'un compte pro (couvre tous ses établissements).
 * `grantedUntil` = accès offert par le super-admin, sans paiement Stripe.
 */
export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("free"),
  interval: billingIntervalEnum("interval"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  grantedUntil: timestamp("granted_until", { withTimezone: true }),
  extraSeats: integer("extra_seats").notNull().default(0),
  ...timestamps,
});

/**
 * Catalogue des modules activables (rendez-vous, téléphone IA, SMS, site…).
 * C'est la base de la plateforme « site + modules ».
 */
export const modules = pgTable("modules", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  stripePriceId: text("stripe_price_id"),
  isAvailable: boolean("is_available").notNull().default(true),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

/**
 * Forfait d'un établissement (le forfait est porté par l'établissement, comme dans l'ancien
 * Branshee). Pas de ligne = gratuit, sauf abonnement « compte » hérité de l'ancien système.
 * `grantedUntil` = accès offert (super-admin, lien d'accès) sans paiement Stripe.
 */
export const businessPlans = pgTable("business_plans", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("free"),
  interval: billingIntervalEnum("interval"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  grantedUntil: timestamp("granted_until", { withTimezone: true }),
  extraSeats: integer("extra_seats").notNull().default(0),
  customUrlAddon: boolean("custom_url_addon").notNull().default(false),
  ...timestamps,
});

/** Modules activés sur un établissement. */
export const businessModules = pgTable(
  "business_modules",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    moduleKey: text("module_key")
      .notNull()
      .references(() => modules.key),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    stripeSubscriptionItemId: text("stripe_subscription_item_id"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.moduleKey] })],
);

/** Crédit SMS prépayé. */
export const smsWallets = pgTable("sms_wallets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balanceCents: integer("balance_cents").notNull().default(0),
  autoRecharge: jsonb("auto_recharge")
    .$type<{ enabled: boolean; thresholdCents: number; amountCents: number }>()
    .notNull()
    .default({ enabled: false, thresholdCents: 500, amountCents: 2000 }),
  lowBalanceAlert: text("low_balance_alert", { enum: ["info", "warning"] }),
  monthKey: text("month_key"),
  monthCount: integer("month_count").notNull().default(0),
  lastAutoRechargeFailureAt: timestamp("last_auto_recharge_failure_at", { withTimezone: true }),
  ...timestamps,
});

export const promoCodes = pgTable("promo_codes", {
  id: id(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type", { enum: ["percent", "fixed", "trial"] }).notNull(),
  discountValue: integer("discount_value").notNull(),
  trialDays: integer("trial_days").notNull().default(30),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  isDefaultOffer: boolean("is_default_offer").notNull().default(false),
  /** Forfait + période concernés, ex. "pro:month" ; null = tous. */
  appliesTo: text("applies_to"),
  legacyId: legacyId(),
  ...timestamps,
});

export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    promoCodeId: uuid("promo_code_id")
      .notNull()
      .references(() => promoCodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.promoCodeId, t.userId] })],
);

/** Campagne promo affichée avec compte à rebours (une seule à la fois). */
export const promoCampaigns = pgTable("promo_campaigns", {
  id: id(),
  isActive: boolean("is_active").notNull().default(false),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  firstPeriodCents: integer("first_period_cents").notNull().default(100),
  days: integer("days").notNull().default(30),
  plan: planEnum("plan").notNull().default("pro"),
  ...timestamps,
});

/** Lien d'accès offert (forfait gratuit pendant N jours). */
export const accessLinks = pgTable("access_links", {
  id: id(),
  code: text("code").notNull().unique(),
  label: text("label"),
  plan: planEnum("plan").notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const accessLinkUses = pgTable(
  "access_link_uses",
  {
    id: id(),
    accessLinkId: uuid("access_link_id")
      .notNull()
      .references(() => accessLinks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email"),
    ip: text("ip"),
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("access_link_uses_link_idx").on(t.accessLinkId)],
);

/** Mois offerts gagnés par parrainage et déjà utilisés. */
export const referralCredits = pgTable("referral_credits", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  monthsClaimed: integer("months_claimed").notNull().default(0),
  ...timestamps,
});

/** Paiements Stripe déjà traités (recharges SMS…) : évite de créditer deux fois (retour + webhook). */
export const processedPayments = pgTable("processed_payments", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
