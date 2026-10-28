import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { businesses } from "./businesses";
import { members } from "./team";

/** App Messagerie (Skydev) : salon d'équipe ou discussion privée entre deux membres. */
export const chatChannels = pgTable(
  "chat_channels",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** channel | direct */
    kind: text("kind").notNull().default("channel"),
    name: text("name"),
    /** Discussion privée : « membreA:membreB » (ids triés), unique par entreprise. */
    directKey: text("direct_key"),
    createdById: uuid("created_by_id").references(() => members.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_channels_business_idx").on(t.businessId), uniqueIndex("chat_channels_direct_uq").on(t.businessId, t.directKey)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("chat_messages_channel_idx").on(t.channelId, t.createdAt)],
);

/** Dernière lecture d'un membre dans un salon (pastilles « non lus »). */
export const chatReads = pgTable(
  "chat_reads",
  {
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.memberId] })],
);
