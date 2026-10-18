"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, supervisionRequests, users } from "@/db/schema";
import { requireSuperadmin } from "@/server/admin";
import { endImpersonationsFor, getSessionUser } from "@/server/auth/session";

type Result = { ok: boolean; error?: string };

/** Le super-admin demande à voir l'espace d'un pro : le pro doit accepter dans les 10 minutes. */
export async function requestSupervision(userId: string): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(userId);
  if (id === admin.id) return { ok: false, error: "C'est votre propre compte." };
  const [u] = await db.select({ id: users.id, disabledAt: users.disabledAt }).from(users).where(eq(users.id, id));
  if (!u) return { ok: false, error: "Utilisateur introuvable." };
  if (u.disabledAt) return { ok: false, error: "Ce compte est désactivé." };
  await db.update(supervisionRequests).set({ status: "closed" }).where(and(eq(supervisionRequests.userId, id), eq(supervisionRequests.status, "pending")));
  await db.insert(supervisionRequests).values({ userId: id, requestedById: admin.id, status: "pending", expiresAt: new Date(Date.now() + 10 * 60000) });
  revalidatePath(`/admin/utilisateurs/${id}`);
  return { ok: true };
}

/** Côté pro : demande en attente, et supervision en cours. Appelé régulièrement par l'espace pro. */
export async function supervisionStatus(): Promise<{ pending: { id: string; expiresAt: string } | null; active: boolean }> {
  const s = await getSessionUser();
  if (!s || s.impersonatedById) return { pending: null, active: false };
  const [p] = await db
    .select({ id: supervisionRequests.id, expiresAt: supervisionRequests.expiresAt })
    .from(supervisionRequests)
    .where(and(eq(supervisionRequests.userId, s.user.id), eq(supervisionRequests.status, "pending"), gt(supervisionRequests.expiresAt, new Date())))
    .limit(1);
  const [a] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, s.user.id), isNotNull(sessions.impersonatedById), gt(sessions.expiresAt, new Date()))).limit(1);
  return { pending: p ? { id: p.id, expiresAt: p.expiresAt!.toISOString() } : null, active: !!a };
}

export async function respondSupervision(requestId: string, accept: boolean): Promise<Result> {
  const s = await getSessionUser();
  if (!s || s.impersonatedById) return { ok: false };
  const id = z.uuid().parse(requestId);
  const [r] = await db
    .update(supervisionRequests)
    .set({ status: accept ? "accepted" : "refused", expiresAt: new Date(Date.now() + 10 * 60000) })
    .where(and(eq(supervisionRequests.id, id), eq(supervisionRequests.userId, s.user.id), eq(supervisionRequests.status, "pending"), gt(supervisionRequests.expiresAt, new Date())))
    .returning({ id: supervisionRequests.id });
  return r ? { ok: true } : { ok: false, error: "Cette demande a expiré." };
}

/** Le pro met fin à la supervision à tout moment. */
export async function endSupervision(): Promise<Result> {
  const s = await getSessionUser();
  if (!s || s.impersonatedById) return { ok: false };
  await db.update(supervisionRequests).set({ status: "closed" }).where(and(eq(supervisionRequests.userId, s.user.id), eq(supervisionRequests.status, "accepted")));
  await endImpersonationsFor(s.user.id);
  return { ok: true };
}
