import { date, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { businesses } from "./businesses";
import { members } from "./team";

/**
 * App Tâches : listes partagées. `visibility` : team (toute l'équipe), private (son créateur seulement),
 * members (le créateur et les membres choisis dans todo_list_members).
 */
export const todoLists = pgTable(
  "todo_lists",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("slate"),
    visibility: text("visibility").notNull().default("team"),
    createdByMemberId: uuid("created_by_member_id").references(() => members.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("todo_lists_business_idx").on(t.businessId)],
);

export const todoListMembers = pgTable(
  "todo_list_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.listId, t.memberId] })],
);

/** Tâche (ou sous-tâche si `parentId`). Sans liste : boîte de réception de son créateur. */
export const todoTasks = pgTable(
  "todo_tasks",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => todoLists.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    dueDate: date("due_date"),
    /** HH:MM, facultatif. */
    dueTime: text("due_time"),
    /** 1 (urgent) à 4 (normal). */
    priority: integer("priority").notNull().default(4),
    /** daily | weekdays | weekly | monthly | yearly */
    recurrence: text("recurrence"),
    assigneeMemberId: uuid("assignee_member_id").references(() => members.id, { onDelete: "set null" }),
    createdByMemberId: uuid("created_by_member_id").references(() => members.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByMemberId: uuid("completed_by_member_id").references(() => members.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("todo_tasks_business_idx").on(t.businessId, t.completedAt), index("todo_tasks_list_idx").on(t.listId), index("todo_tasks_assignee_idx").on(t.assigneeMemberId), index("todo_tasks_parent_idx").on(t.parentId)],
);
