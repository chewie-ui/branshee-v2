"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessLinkUses, accessLinks, activityLogs, businessPlans, businesses } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";

/** Lien d'accès offert (créé par le super-admin) : forfait gratuit pendant N jours sur un établissement possédé. */
export async function redeemAccessLink(code: string, businessId: string): Promise<{ ok: false; error: string } | never> {
  const s = await getSessionUser();
  if (!s) redirect(`/connexion?suite=${encodeURIComponent(`/acces/${code}`)}`);
  const [link] = await db.select().from(accessLinks).where(and(eq(accessLinks.code, code), eq(accessLinks.isActive, true)));
  if (!link || (link.expiresAt && link.expiresAt < new Date()) || link.usedCount >= link.maxUses) return { ok: false, error: "Ce lien n'est plus valable." };
  const [biz] = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(and(eq(businesses.id, businessId), eq(businesses.ownerId, s.user.id), isNull(businesses.deletedAt)));
  if (!biz) return { ok: false, error: "Choisissez un de vos établissements." };
  const [already] = await db.select({ id: accessLinkUses.id }).from(accessLinkUses).where(and(eq(accessLinkUses.accessLinkId, link.id), eq(accessLinkUses.userId, s.user.id)));
  if (already) return { ok: false, error: "Vous avez déjà utilisé ce lien." };
  const claimed = await db.update(accessLinks).set({ usedCount: sql`${accessLinks.usedCount} + 1` }).where(and(eq(accessLinks.id, link.id), sql`${accessLinks.usedCount} < ${accessLinks.maxUses}`)).returning({ id: accessLinks.id });
  if (!claimed.length) return { ok: false, error: "Ce lien vient d'être utilisé jusqu'au bout." };
  const until = new Date(Date.now() + link.durationDays * 86400000);
  const [cur] = await db.select().from(businessPlans).where(eq(businessPlans.businessId, biz.id));
  if (cur?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(cur.status)) return { ok: false, error: "Cet établissement a déjà un abonnement payant." };
  const values = { plan: link.plan, status: "active" as const, grantedUntil: until, stripeSubscriptionId: null, isTrial: false };
  await db.insert(businessPlans).values({ businessId: biz.id, ...values }).onConflictDoUpdate({ target: businessPlans.businessId, set: values });
  const h = await headers();
  await db.insert(accessLinkUses).values({ accessLinkId: link.id, userId: s.user.id, email: s.user.email, ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null });
  await db.insert(activityLogs).values({ businessId: biz.id, userId: s.user.id, actorName: s.user.fullName, action: "billing.access_link", description: `Accès offert activé (${link.durationDays} jours)` });
  redirect("/app/reglages/abonnement");
}
