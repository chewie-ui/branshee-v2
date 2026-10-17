import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { id, legacyId, timestamps } from "./_shared";
import { businesses, type SocialLinks } from "./businesses";
import { users } from "./users";

export type SiteSectionType = "hero" | "services" | "booking" | "about" | "gallery" | "testimonials" | "faq" | "contact" | "stats" | "cta";

/** Site vitrine d'un établissement (créateur de site « Mon site »). */
export const sites = pgTable("sites", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  slug: text("slug").unique(),
  customDomain: text("custom_domain").unique(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  template: text("template").notNull().default("1"),
  theme: jsonb("theme")
    .$type<{ primaryColor: string; bgColor: string; textColor: string; fontFamily: string; headingFont?: string; roundness: "sharp" | "soft" | "round" }>()
    .notNull()
    .default({ primaryColor: "#4f46e5", bgColor: "#ffffff", textColor: "#0f0f1a", fontFamily: "Inter", roundness: "soft" }),
  seo: jsonb("seo").$type<{ title?: string; description?: string }>().notNull().default({}),
  sections: jsonb("sections")
    .$type<{ id: string; type: SiteSectionType; enabled: boolean; data: Record<string, unknown> }[]>()
    .notNull()
    .default([]),
  logoUrl: text("logo_url"),
  social: jsonb("social").$type<SocialLinks>().notNull().default({}),
  visitCount: integer("visit_count").notNull().default(0),
  legacyId: legacyId(),
  ...timestamps,
});

/** Message du super-admin à un pro (ou à tous si `recipientId` est null). */
export const adminMessages = pgTable(
  "admin_messages",
  {
    id: id(),
    recipientId: uuid("recipient_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type", { enum: ["info", "warning", "security", "success", "tip"] }).notNull().default("info"),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    ...timestamps,
  },
  (t) => [index("admin_messages_recipient_idx").on(t.recipientId, t.createdAt)],
);

export const adminMessageDismissals = pgTable(
  "admin_message_dismissals",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => adminMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })],
);

/** Conversation de support entre un pro et l'équipe Branshee. */
export const supportThreads = pgTable("support_threads", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  unreadByAdmin: integer("unread_by_admin").notNull().default(0),
  unreadByUser: integer("unread_by_user").notNull().default(0),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  rating: integer("rating"),
  ...timestamps,
});

export const supportMessages = pgTable(
  "support_messages",
  {
    id: id(),
    threadUserId: uuid("thread_user_id")
      .notNull()
      .references(() => supportThreads.userId, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["user", "admin"] }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("support_messages_thread_idx").on(t.threadUserId, t.createdAt)],
);

/** Centre d'aide : sections avec vidéos et FAQ. */
export const helpSections = pgTable("help_sections", {
  id: id(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  videos: jsonb("videos").$type<{ id: string; title: string; url: string; duration?: string }[]>().notNull().default([]),
  faqs: jsonb("faqs").$type<{ id: string; question: string; answer: string }[]>().notNull().default([]),
  ...timestamps,
});

/** Articles du blog public (SEO). */
export const articles = pgTable(
  "articles",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    coverImageUrl: text("cover_image_url"),
    contentHtml: text("content_html").notNull().default(""),
    category: text("category"),
    tags: text("tags").array().notNull().default([]),
    status: text("status", { enum: ["draft", "scheduled", "published"] }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    authorName: text("author_name").notNull().default("L’équipe Branshee"),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    views: integer("views").notNull().default(0),
    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [index("articles_published_idx").on(t.status, t.publishedAt)],
);

/** Interrupteurs de fonctionnalités pilotés depuis le super-admin. */
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  status: text("status", { enum: ["active", "maintenance", "error", "disabled"] }).notNull().default("active"),
  message: text("message"),
  hiddenInNav: boolean("hidden_in_nav").notNull().default(false),
  ...timestamps,
});

/** Métiers proposés par les pros, à valider par le super-admin. */
export const jobTitles = pgTable("job_titles", {
  id: id(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  status: text("status", { enum: ["pending", "approved", "blocked"] }).notNull().default("pending"),
  source: text("source", { enum: ["request", "usage"] }).notNull().default("request"),
  requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...timestamps,
});

/** Demande du super-admin pour accéder au compte d'un pro (le pro accepte ou refuse). */
export const supervisionRequests = pgTable("supervision_requests", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requestedById: uuid("requested_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted", "refused", "closed"] }).notNull().default("pending"),
  tokenHash: text("token_hash").unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
});

export const pageViews = pgTable(
  "page_views",
  {
    id: id(),
    visitorId: text("visitor_id").notNull(),
    path: text("path").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    gclid: text("gclid"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("page_views_created_idx").on(t.createdAt)],
);

/** Journal des emails envoyés (ou tentés) : utile au support et pour éviter les doublons. */
export const emailLogs = pgTable(
  "email_logs",
  {
    id: id(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    appointmentId: uuid("appointment_id"),
    template: text("template").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    status: text("status", { enum: ["sent", "failed", "logged"] }).notNull(),
    error: text("error"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("email_logs_created_idx").on(t.createdAt), index("email_logs_appointment_idx").on(t.appointmentId)],
);
