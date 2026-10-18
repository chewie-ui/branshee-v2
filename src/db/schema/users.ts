import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, legacyId, timestamps } from "./_shared";

export const localeEnum = pgEnum("locale", ["fr", "en", "nl", "de", "es", "it"]);
export const loginMethodEnum = pgEnum("login_method", ["password", "two_factor", "google", "apple"]);

/**
 * Compte utilisateur unique.
 * L'ancien Branshee séparait les pros (`User`) et les clients finaux (`Client`).
 * En v2 il n'y a qu'un compte : une même personne peut gérer un établissement
 * ET prendre rendez-vous ailleurs.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull().unique(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash"),
    googleId: text("google_id").unique(),
    appleId: text("apple_id").unique(),
    avatarUrl: text("avatar_url"),
    phone: text("phone"),
    locale: localeEnum("locale").notNull().default("fr"),
    birthDate: date("birth_date"),
    gender: text("gender"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country"),
    emailNotifications: boolean("email_notifications").notNull().default(true),

    /** Secret TOTP chiffré (null = double authentification désactivée). */
    twoFactorSecret: text("two_factor_secret"),
    /** Incrémenté pour invalider toutes les sessions ouvertes. */
    sessionVersion: integer("session_version").notNull().default(0),

    isSuperadmin: boolean("is_superadmin").notNull().default(false),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    /** Parrainage : code personnel et parrain éventuel. */
    referralCode: text("referral_code").unique(),
    referredById: uuid("referred_by_id"),
    /** Premier paiement d'un filleul : il compte alors pour son parrain (une seule fois). */
    referralPaidAt: timestamp("referral_paid_at", { withTimezone: true }),
    /** Intention déclarée à l'inscription (« client » = venu réserver : pas de relances pro). */
    signupIntent: text("signup_intent", { enum: ["pro", "client"] }),
    /** Relances déjà envoyées : palier « bien démarrer » (J+1 = 1, J+3 = 2) et « créez votre établissement ». */
    nudges: jsonb("nudges").$type<{ onboardingStage?: number; createBusinessAt?: string }>().notNull().default({}),

    /** Origine de l'inscription (UTM, gclid, page d'atterrissage…). */
    acquisition: jsonb("acquisition").$type<{
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
      gclid?: string;
      referrer?: string;
      landing?: string;
      capturedAt?: string;
    }>(),

    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [index("users_referred_by_idx").on(t.referredById)],
);

/** Sessions de connexion (cookie httpOnly → jeton haché en base). */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    /** Super-admin connecté « en tant que » cet utilisateur. */
    impersonatedById: uuid("impersonated_by_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Codes à usage unique : mot de passe oublié, changement d'email, suppression de compte. */
export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    purpose: text("purpose", { enum: ["password_reset", "email_change", "account_deletion", "email_verification"] }).notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("verification_codes_email_idx").on(t.email, t.purpose)],
);

export const loginEvents = pgTable(
  "login_events",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    method: loginMethodEnum("method").notNull(),
    ip: text("ip"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("login_events_user_idx").on(t.userId, t.createdAt)],
);

export const pushTokens = pgTable("push_tokens", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform", { enum: ["ios", "android", "web", "unknown"] }).notNull().default("unknown"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

/** Connexion Google Agenda d'un utilisateur (jetons chiffrés). */
export const googleCalendarConnections = pgTable("google_calendar_connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  googleEmail: text("google_email").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  accessTokenEnc: text("access_token_enc"),
  scope: text("scope"),
  ...timestamps,
});
