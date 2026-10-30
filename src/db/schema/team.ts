import { boolean, check, date, index, jsonb, pgEnum, pgTable, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Permissions } from "@/lib/permissions";
import { id, legacyId, timestamps, type TimeRange } from "./_shared";
import { businesses } from "./businesses";
import { users } from "./users";

export const memberStatusEnum = pgEnum("member_status", ["invited", "requested", "active", "rejected"]);

/** Grade (rôle) défini par le patron, avec ses permissions. */
export const grades = pgTable(
  "grades",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isBuiltIn: boolean("is_built_in").notNull().default(false),
    permissions: jsonb("permissions").$type<Permissions>().notNull(),
    /** Skydev : apps ouvertes à ce grade (null = toutes). Le titulaire a toujours tout. */
    appAccess: jsonb("app_access").$type<string[]>(),
    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [uniqueIndex("grades_business_name_uq").on(t.businessId, t.name)],
);

/**
 * Membre d'un établissement : le propriétaire ET chaque collaborateur.
 * Remplace `Employee`, `CompanyMembership` et `Company.ownerEmployeeProfile`
 * de l'ancien code — trois façons de décrire la même chose.
 */
export const members = pgTable(
  "members",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** Null pour un membre sans compte (ex. ancien `Employee`). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Email d'invitation : le membre est relié au compte créé (ou existant) avec cette adresse. */
    inviteEmail: text("invite_email"),
    isOwner: boolean("is_owner").notNull().default(false),
    status: memberStatusEnum("status").notNull().default("invited"),
    gradeId: uuid("grade_id").references(() => grades.id, { onDelete: "set null" }),
    /** Peut gérer ses congés lui-même (null = suit le grade). */
    canManageOwnTimeOff: boolean("can_manage_own_time_off"),
    isActive: boolean("is_active").notNull().default(true),
    /** Réservable par les clients (apparaît dans le choix du praticien). */
    isBookable: boolean("is_bookable").notNull().default(true),

    displayName: text("display_name").notNull(),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    roleLabel: text("role_label"),
    showRole: boolean("show_role").notNull().default(false),
    customInfo: jsonb("custom_info").$type<{ label: string; value: string }[]>().notNull().default([]),
    calendarColor: text("calendar_color"),
    /** Jeton du flux iCal personnel (abonnement depuis Google/Apple Agenda). */
    calendarFeedToken: text("calendar_feed_token").unique(),

    joinedAt: timestamp("joined_at", { withTimezone: true }),
    /** Préférences personnelles : apps favorites (épinglées en tête de l'accueil et en raccourcis). */
    prefs: jsonb("prefs").$type<{ favApps?: string[] }>().notNull().default({}),
    legacyId: legacyId(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("members_business_user_uq").on(t.businessId, t.userId),
    index("members_user_idx").on(t.userId),
  ],
);

/**
 * Horaires hebdomadaires, une ligne par plage.
 * `memberId` null = horaires communs de l'établissement (mode « partagé »).
 * Un jour sans aucune ligne est un jour fermé.
 */
export const weeklyHours = pgTable(
  "weekly_hours",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    /** 0 = dimanche … 6 = samedi (comme `Date.getDay()`). */
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    ...timestamps,
  },
  (t) => [
    index("weekly_hours_lookup_idx").on(t.businessId, t.memberId, t.weekday),
    check("weekly_hours_weekday_ck", sql`${t.weekday} between 0 and 6`),
    check("weekly_hours_order_ck", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/**
 * Exception à une date : fermeture, congé ou horaires spéciaux.
 * `memberId` null = s'applique à tout l'établissement.
 */
export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** true = fermé toute la journée ; false = remplacé par `hours`. */
    isClosed: boolean("is_closed").notNull().default(true),
    hours: jsonb("hours").$type<TimeRange[]>().notNull().default([]),
    reason: text("reason"),
    /** Congé validé dans l'app Congés (Skydev) qui a créé ce jour fermé ; null = saisi à la main. */
    leaveRequestId: uuid("leave_request_id"),
    ...timestamps,
  },
  (t) => [index("schedule_exceptions_lookup_idx").on(t.businessId, t.date), index("schedule_exceptions_leave_idx").on(t.leaveRequestId)],
);
