import { boolean, date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { customers } from "./appointments";
import { members } from "./team";

/** App Projets (Skydev) : un projet, un chantier, un dossier client. */
export const projects = pgTable(
  "projects",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** active | done | archived */
    status: text("status").notNull().default("active"),
    color: text("color").notNull().default("indigo"),
    /** Tarif horaire HTVA pour facturer le temps (0 = pas facturé à l'heure). */
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    budgetMinutes: integer("budget_minutes"),
    deadline: date("deadline"),
    ...timestamps,
  },
  (t) => [index("projects_business_idx").on(t.businessId, t.status)],
);

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** todo | doing | review | done */
    status: text("status").notNull().default("todo"),
    assigneeMemberId: uuid("assignee_member_id").references(() => members.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    estimateMinutes: integer("estimate_minutes"),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("project_tasks_project_idx").on(t.projectId, t.status), index("project_tasks_assignee_idx").on(t.businessId, t.assigneeMemberId)],
);

/** Temps passé (saisi ou chronométré), facturable ou non. */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => projectTasks.id, { onDelete: "set null" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    day: date("day").notNull(),
    minutes: integer("minutes").notNull(),
    note: text("note"),
    billable: boolean("billable").notNull().default(true),
    /** Brouillon de facture qui reprend ce temps (app Factures). */
    invoiceId: uuid("invoice_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("time_entries_project_idx").on(t.projectId, t.day), index("time_entries_member_idx").on(t.businessId, t.memberId, t.day)],
);
