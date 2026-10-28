import "server-only";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatChannels, members } from "@/db/schema";
import type { AppContext } from "@/server/context";

export const directKey = (a: string, b: string) => [a, b].sort().join(":");
export const chatRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });

/** Le salon est-il visible par ce membre ? (salon d'équipe : tous ; discussion privée : les deux membres). */
export async function chatChannelFor(ctx: AppContext, channelId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(channelId)) return null;
  const [c] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, channelId), eq(chatChannels.businessId, ctx.business.id)));
  if (!c) return null;
  if (c.kind === "direct" && !c.directKey?.split(":").includes(ctx.member.id)) return null;
  return c;
}

/** Salons, discussions privées et nombre de messages non lus. Crée le salon « Général » au premier passage. */
export async function chatOverview(ctx: AppContext) {
  const [general] = await db.select({ id: chatChannels.id }).from(chatChannels).where(and(eq(chatChannels.businessId, ctx.business.id), eq(chatChannels.kind, "channel"))).limit(1);
  if (!general) await db.insert(chatChannels).values({ businessId: ctx.business.id, kind: "channel", name: "Général" });
  const me = ctx.member.id;
  const rows = await db
    .select({
      id: chatChannels.id,
      kind: chatChannels.kind,
      name: chatChannels.name,
      directKey: chatChannels.directKey,
      lastMessageAt: chatChannels.lastMessageAt,
      unread: sql<number>`(select count(*)::int from chat_messages m where m.channel_id = "chat_channels"."id" and m.deleted_at is null and (m.member_id is null or m.member_id <> ${me}) and m.created_at > coalesce((select r.last_read_at from chat_reads r where r.channel_id = "chat_channels"."id" and r.member_id = ${me}), 'epoch'::timestamptz))`,
    })
    .from(chatChannels)
    .where(and(eq(chatChannels.businessId, ctx.business.id), or(eq(chatChannels.kind, "channel"), like(chatChannels.directKey, `%${me}%`))))
    .orderBy(asc(chatChannels.kind), asc(chatChannels.createdAt));
  const team = await db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), eq(members.isActive, true))).orderBy(asc(members.displayName));
  return { channels: rows.map((r) => ({ ...r, lastMessageAt: r.lastMessageAt?.toISOString() ?? null })), team };
}

