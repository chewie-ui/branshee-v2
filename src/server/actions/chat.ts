"use server";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatChannels, chatMessages, chatReads, members } from "@/db/schema";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { chatChannelFor, chatOverview, chatRights, directKey } from "@/server/chat";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
export type ChatMessage = { id: string; memberId: string | null; author: string | null; body: string; createdAt: string; deleted: boolean };

/** Messages d'un salon : les 100 derniers, ou seulement les nouveaux après une date (rafraîchissement). Marque comme lu. */
export async function fetchMessages(channelId: string, after?: string | null): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  const ctx = await requireContext();
  const c = await chatChannelFor(ctx, channelId);
  if (!c) return { ok: false, error: "Discussion introuvable." };
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
  const rows = await db
    .select({ id: chatMessages.id, memberId: chatMessages.memberId, author: members.displayName, body: chatMessages.body, createdAt: chatMessages.createdAt, deletedAt: chatMessages.deletedAt })
    .from(chatMessages)
    .leftJoin(members, eq(members.id, chatMessages.memberId))
    .where(and(eq(chatMessages.channelId, c.id), since ? gt(chatMessages.createdAt, since) : undefined))
    .orderBy(desc(chatMessages.createdAt))
    .limit(100);
  if (!ctx.impersonating) await db.insert(chatReads).values({ channelId: c.id, memberId: ctx.member.id }).onConflictDoUpdate({ target: [chatReads.channelId, chatReads.memberId], set: { lastReadAt: new Date() } });
  return { ok: true, messages: rows.reverse().map((m) => ({ id: m.id, memberId: m.memberId, author: m.author, body: m.deletedAt ? "" : m.body, createdAt: m.createdAt.toISOString(), deleted: !!m.deletedAt })) };
}

/** Liste des salons (pastilles non lus), rafraîchie régulièrement par la page. */
export async function chatList() {
  const ctx = await requireContext();
  return (await chatOverview(ctx)).channels;
}

export async function sendMessage(channelId: string, body: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = z.string().trim().min(1).max(4000).safeParse(body);
  if (!v.success) return { ok: false, error: "Message vide ou trop long (4 000 caractères maximum)." };
  if (!rateLimit(`chat:${ctx.member.id}`, 30, 60_000).ok) return { ok: false, error: "Doucement : trop de messages d'un coup." };
  const c = await chatChannelFor(ctx, channelId);
  if (!c) return { ok: false, error: "Discussion introuvable." };
  const [m] = await db.insert(chatMessages).values({ businessId: ctx.business.id, channelId: c.id, memberId: ctx.member.id, body: v.data }).returning({ id: chatMessages.id });
  await db.update(chatChannels).set({ lastMessageAt: new Date() }).where(eq(chatChannels.id, c.id));
  return { ok: true, id: m!.id };
}

export async function deleteMessage(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Message introuvable." };
  const [m] = await db.select({ memberId: chatMessages.memberId, channelId: chatMessages.channelId }).from(chatMessages).where(and(eq(chatMessages.id, id), eq(chatMessages.businessId, ctx.business.id)));
  if (!m || !(await chatChannelFor(ctx, m.channelId))) return { ok: false, error: "Message introuvable." };
  if (m.memberId !== ctx.member.id && !chatRights(ctx).manage) return { ok: false, error: "Vous ne pouvez supprimer que vos messages." };
  await db.update(chatMessages).set({ deletedAt: new Date() }).where(and(eq(chatMessages.id, id), isNull(chatMessages.deletedAt)));
  return { ok: true };
}

export async function createChannel(name: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = z.string().trim().min(1, "Donnez un nom au salon.").max(40).safeParse(name);
  if (!v.success) return { ok: false, error: v.error.issues[0]!.message };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(chatChannels).where(and(eq(chatChannels.businessId, ctx.business.id), eq(chatChannels.kind, "channel")));
  if (n >= 50) return { ok: false, error: "50 salons maximum." };
  const [c] = await db.insert(chatChannels).values({ businessId: ctx.business.id, kind: "channel", name: v.data, createdById: ctx.member.id }).returning({ id: chatChannels.id });
  return { ok: true, id: c!.id, message: "Salon créé." };
}

export async function deleteChannel(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!chatRights(ctx).manage) return { ok: false, error: "Seul le responsable peut supprimer un salon." };
  const c = await chatChannelFor(ctx, id);
  if (!c || c.kind !== "channel") return { ok: false, error: "Salon introuvable." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(chatChannels).where(and(eq(chatChannels.businessId, ctx.business.id), eq(chatChannels.kind, "channel")));
  if (n <= 1) return { ok: false, error: "Gardez au moins un salon." };
  await db.delete(chatChannels).where(eq(chatChannels.id, c.id));
  return { ok: true, message: "Salon supprimé." };
}

/** Ouvre (ou crée) la discussion privée avec un membre de l'équipe. */
export async function openDirect(memberId: string): Promise<Result> {
  const ctx = await requireContext();
  if (!z.uuid().safeParse(memberId).success || memberId === ctx.member.id) return { ok: false, error: "Personne introuvable." };
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id)));
  if (!m) return { ok: false, error: "Personne introuvable." };
  const key = directKey(ctx.member.id, memberId);
  const [existing] = await db.select({ id: chatChannels.id }).from(chatChannels).where(and(eq(chatChannels.businessId, ctx.business.id), eq(chatChannels.directKey, key)));
  if (existing) return { ok: true, id: existing.id };
  if (ctx.impersonating) return SUPERVISION;
  const [c] = await db.insert(chatChannels).values({ businessId: ctx.business.id, kind: "direct", directKey: key, createdById: ctx.member.id }).onConflictDoNothing().returning({ id: chatChannels.id });
  if (c) return { ok: true, id: c.id };
  const [again] = await db.select({ id: chatChannels.id }).from(chatChannels).where(and(eq(chatChannels.businessId, ctx.business.id), eq(chatChannels.directKey, key)));
  return again ? { ok: true, id: again.id } : { ok: false, error: "Discussion impossible." };
}
