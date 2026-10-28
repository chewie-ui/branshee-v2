import { date, integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { users } from "./users";

/** Assistant IA (Skydev) : activé explicitement par le responsable (les questions partent chez un fournisseur d'IA). */
export const assistantSettings = pgTable("assistant_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  enabledById: uuid("enabled_by_id").references(() => users.id, { onDelete: "set null" }),
});

/** Questions posées par jour (plafond contre les abus et les coûts). */
export const assistantUsage = pgTable(
  "assistant_usage",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.day] })],
);
