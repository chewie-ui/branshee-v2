"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, businesses, grades, members, users } from "@/db/schema";
import { rateLimit } from "@/server/auth/rate-limit";
import { BUSINESS_COOKIE, getSessionUser } from "@/server/auth/session";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { collaboratorUsage } from "@/server/plan";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

async function me() {
  const s = await getSessionUser();
  if (!s) redirect("/connexion");
  return s.user;
}
const uuid = (v: string) => z.uuid().parse(v);

/* ───────── Invitations reçues ───────── */

export async function acceptInvitation(memberId: string): Promise<Result> {
  const u = await me();
  const updated = await db
    .update(members)
    .set({ status: "active", joinedAt: new Date(), displayName: sql`coalesce(nullif(${members.displayName}, ''), ${u.fullName})` })
    .where(and(eq(members.id, uuid(memberId)), eq(members.userId, u.id), eq(members.status, "invited")))
    .returning({ businessId: members.businessId });
  if (!updated.length) return { ok: false, error: "Invitation introuvable." };
  await db.insert(activityLogs).values({ businessId: updated[0]!.businessId, userId: u.id, actorName: u.fullName, action: "team.join", description: `${u.fullName} a rejoint l'équipe` });
  revalidatePath("/", "layout");
  // L'établissement rejoint devient l'établissement actif (le site y emmène l'invité juste après).
  (await cookies()).set(BUSINESS_COOKIE, updated[0]!.businessId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  return { ok: true, message: "Bienvenue dans l'équipe !" };
}

export async function declineInvitation(memberId: string): Promise<Result> {
  const u = await me();
  const updated = await db
    .update(members)
    .set({ status: "rejected", userId: null })
    .where(and(eq(members.id, uuid(memberId)), eq(members.userId, u.id), eq(members.status, "invited")))
    .returning({ id: members.id });
  if (!updated.length) return { ok: false, error: "Invitation introuvable." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Invitation refusée." };
}

/* ───────── Demandes pour rejoindre ───────── */

export async function searchBusinesses(q: string) {
  await me();
  const term = String(q ?? "").trim().slice(0, 60);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return db
    .select({ id: businesses.id, name: businesses.name, city: businesses.city, businessType: businesses.businessType, photoUrl: businesses.photoUrl })
    .from(businesses)
    .where(and(isNull(businesses.deletedAt), or(ilike(businesses.name, like), ilike(businesses.city, like))))
    .orderBy(asc(businesses.name))
    .limit(10);
}

export async function requestJoin(businessId: string): Promise<Result> {
  const u = await me();
  if (!rateLimit(`join:${u.id}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  const [biz] = await db.select({ id: businesses.id, name: businesses.name, ownerId: businesses.ownerId }).from(businesses).where(and(eq(businesses.id, uuid(businessId)), isNull(businesses.deletedAt)));
  if (!biz) return { ok: false, error: "Établissement introuvable." };
  const [existing] = await db.select().from(members).where(and(eq(members.businessId, biz.id), eq(members.userId, u.id)));
  if (existing?.status === "active") return { ok: false, error: "Vous faites déjà partie de cet établissement." };
  if (existing?.status === "requested") return { ok: false, error: "Demande déjà envoyée." };
  if (existing?.status === "invited") return { ok: false, error: "Vous êtes déjà invité : acceptez l'invitation." };
  if (existing) await db.update(members).set({ status: "requested", displayName: u.fullName }).where(eq(members.id, existing.id));
  else await db.insert(members).values({ businessId: biz.id, userId: u.id, status: "requested", displayName: u.fullName, isBookable: false });
  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, biz.ownerId));
  if (owner) await sendEmail({ ...emails.joinRequest({ businessName: biz.name, requesterName: u.fullName, url: `${appUrl()}/app/equipe` }), to: owner.email, template: "join_request", businessId: biz.id });
  revalidatePath("/app/etablissements");
  return { ok: true, message: `Demande envoyée à ${biz.name}.` };
}

export async function cancelJoinRequest(memberId: string): Promise<Result> {
  const u = await me();
  await db.delete(members).where(and(eq(members.id, uuid(memberId)), eq(members.userId, u.id), eq(members.status, "requested")));
  revalidatePath("/app/etablissements");
  return { ok: true };
}

export async function decideJoinRequest(memberId: string, accept: boolean): Promise<Result> {
  const ctx = await requireContext("team.manage");
  const [m] = await db.select().from(members).where(and(eq(members.id, uuid(memberId)), eq(members.businessId, ctx.business.id), eq(members.status, "requested")));
  if (!m) return { ok: false, error: "Demande introuvable." };
  if (accept) {
    const seats = await collaboratorUsage(ctx.business.id);
    if (seats.used >= seats.max) return { ok: false, error: seats.max === 0 ? "Le forfait Amateur ne permet pas d'avoir des collaborateurs : passez au forfait Pro." : "Plus de place de collaborateur : ajoutez un siège dans Réglages › Abonnement." };
    const [grade] = await db.select({ id: grades.id }).from(grades).where(and(eq(grades.businessId, ctx.business.id), eq(grades.name, "Collaborateur")));
    await db.update(members).set({ status: "active", joinedAt: new Date(), gradeId: grade?.id ?? null, isBookable: true }).where(eq(members.id, m.id));
  } else await db.delete(members).where(eq(members.id, m.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: accept ? "team.request_accept" : "team.request_refuse", description: `${accept ? "Demande acceptée" : "Demande refusée"} : ${m.displayName}` });
  revalidatePath("/app/equipe");
  return { ok: true, message: accept ? `${m.displayName} a rejoint l'équipe.` : "Demande refusée." };
}

/** Quitter un établissement (pas le propriétaire). */
export async function leaveBusiness(businessId: string): Promise<Result> {
  const u = await me();
  const [m] = await db.select().from(members).where(and(eq(members.businessId, uuid(businessId)), eq(members.userId, u.id)));
  if (!m) return { ok: false, error: "Introuvable." };
  if (m.isOwner) return { ok: false, error: "Le propriétaire ne peut pas quitter son établissement : supprimez-le ou transférez-le." };
  await db.update(members).set({ userId: null, status: "rejected", isActive: false }).where(eq(members.id, m.id));
  await db.insert(activityLogs).values({ businessId: m.businessId, userId: u.id, actorName: u.fullName, action: "team.leave", description: `${u.fullName} a quitté l'équipe` });
  revalidatePath("/", "layout");
  return { ok: true, message: "Vous avez quitté l'établissement." };
}

/* ───────── Gestion par le propriétaire ───────── */

async function ownBusiness(businessId: string) {
  const u = await me();
  const [b] = await db.select().from(businesses).where(and(eq(businesses.id, uuid(businessId)), eq(businesses.ownerId, u.id), isNull(businesses.deletedAt)));
  return b ? { u, b } : null;
}

export async function setBusinessPausedByOwner(businessId: string, paused: boolean): Promise<Result> {
  const own = await ownBusiness(businessId);
  if (!own) return { ok: false, error: "Seul le propriétaire peut faire cela." };
  await db.update(businesses).set({ pausedAt: paused ? new Date() : null }).where(eq(businesses.id, own.b.id));
  await db.insert(activityLogs).values({ businessId: own.b.id, userId: own.u.id, actorName: own.u.fullName, action: paused ? "business.pause" : "business.resume", description: paused ? "Réservations en ligne mises en pause" : "Réservations en ligne réactivées" });
  revalidatePath("/", "layout");
  return { ok: true, message: paused ? "Réservations en ligne en pause." : "Réservations en ligne réactivées." };
}

export async function deleteBusinessByOwner(businessId: string, confirmName: string): Promise<Result> {
  const own = await ownBusiness(businessId);
  if (!own) return { ok: false, error: "Seul le propriétaire peut faire cela." };
  if (confirmName.trim().toLowerCase() !== own.b.name.trim().toLowerCase()) return { ok: false, error: "Le nom saisi ne correspond pas." };
  await db.update(businesses).set({ deletedAt: new Date(), pausedAt: new Date() }).where(eq(businesses.id, own.b.id));
  await db.insert(activityLogs).values({ businessId: own.b.id, userId: own.u.id, actorName: own.u.fullName, action: "business.deleted", description: "Établissement supprimé par le propriétaire" });
  revalidatePath("/", "layout");
  return { ok: true, message: "Établissement supprimé." };
}
