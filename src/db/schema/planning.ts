import { index, pgTable, smallint, text, time, date, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { members } from "./team";
import { users } from "./users";

/**
 * App Planning (Skydev) : une plage de travail d'un membre de l'équipe, un jour donné.
 * Fin ≤ début = la plage se termine le lendemain (service du soir, nuit).
 */
export const shifts = pgTable(
  "shifts",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    /** Pause non payée, en minutes. */
    breakMinutes: smallint("break_minutes").notNull().default(0),
    /** Poste ou lieu : « Caisse », « Cuisine », « Chantier Wavre »… */
    label: text("label"),
    note: text("note"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("shifts_business_day_idx").on(t.businessId, t.day), index("shifts_member_day_idx").on(t.memberId, t.day)],
);
