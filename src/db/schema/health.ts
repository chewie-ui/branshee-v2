import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id } from "./_shared";

/**
 * Admin › Santé : erreurs de la plateforme regroupées (même erreur = une ligne, avec un compteur).
 * Une erreur résolue qui revient est rouverte.
 */
export const errorLogs = pgTable(
  "error_logs",
  {
    id: id(),
    fingerprint: text("fingerprint").notNull(),
    /** server | stripe | cron */
    source: text("source").notNull(),
    message: text("message").notNull(),
    detail: text("detail"),
    path: text("path"),
    count: integer("count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("error_logs_fp_uq").on(t.fingerprint), index("error_logs_last_idx").on(t.lastSeenAt)],
);

/** Dernier passage de chaque tâche automatique (rappels, relances, parrainages…). */
export const jobRuns = pgTable("job_runs", {
  name: text("name").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull(),
  lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  ok: boolean("ok").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  result: text("result"),
});
