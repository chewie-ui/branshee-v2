import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, grades, members } from "@/db/schema";
import { can, type PermissionKey, type Permissions } from "@/lib/permissions";
import { BUSINESS_COOKIE, getSessionUser } from "@/server/auth/session";

export type AppContext = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  business: { id: string; name: string; slug: string; businessType: string | null; timezone: string };
  member: { id: string; isOwner: boolean };
  /** Tous les établissements dont l'utilisateur est membre actif (pour le sélecteur). */
  businesses: { id: string; name: string; businessType: string | null }[];
  permissions: Permissions | null;
  can: (key: PermissionKey) => boolean;
};

type Resolved = { kind: "anonymous" } | { kind: "no-business"; user: AppContext["user"] } | { kind: "ok"; ctx: AppContext };

/**
 * Contexte de la requête : utilisateur connecté + établissement actif + ses droits.
 * L'établissement actif est mémorisé dans un cookie ; s'il est absent ou invalide, on prend le premier.
 */
const resolveContext = cache(async (): Promise<Resolved> => {
  const session = await getSessionUser();
  if (!session) return { kind: "anonymous" };
  const u = session.user;
  const user = { id: u.id, name: u.fullName, email: u.email, avatarUrl: u.avatarUrl };

  const rows = await db
    .select({ business: businesses, member: members, permissions: grades.permissions })
    .from(members)
    .innerJoin(businesses, eq(businesses.id, members.businessId))
    .leftJoin(grades, eq(grades.id, members.gradeId))
    .where(and(eq(members.userId, u.id), eq(members.status, "active"), eq(members.isActive, true), isNull(businesses.deletedAt)))
    .orderBy(asc(businesses.createdAt));

  if (rows.length === 0) return { kind: "no-business", user };

  const wanted = (await cookies()).get(BUSINESS_COOKIE)?.value;
  const row = rows.find((r) => r.business.id === wanted) ?? rows[0]!;
  const isOwner = row.member.isOwner;
  const permissions = row.permissions ?? null;

  return {
    kind: "ok",
    ctx: {
      user,
      business: { id: row.business.id, name: row.business.name, slug: row.business.slug, businessType: row.business.businessType, timezone: row.business.timezone },
      member: { id: row.member.id, isOwner },
      businesses: rows.map((r) => ({ id: r.business.id, name: r.business.name, businessType: r.business.businessType })),
      permissions,
      can: (key) => can(permissions, key, isOwner),
    },
  };
});

/** Utilisateur connecté (sans exiger d'établissement), sinon redirection vers la connexion. */
export async function requireUser() {
  const r = await resolveContext();
  if (r.kind === "anonymous") redirect("/connexion");
  return r.kind === "ok" ? r.ctx.user : r.user;
}

/**
 * Pour les pages et actions de l'espace pro.
 * - pas connecté → page de connexion
 * - connecté sans établissement → création d'établissement
 * - permission manquante → page « accès refusé » (la navigation masque déjà ces liens)
 */
export async function requireContext(permission?: PermissionKey): Promise<AppContext> {
  const r = await resolveContext();
  if (r.kind === "anonymous") redirect("/connexion");
  if (r.kind === "no-business") redirect("/bienvenue");
  if (permission && !r.ctx.can(permission)) redirect("/app/acces-refuse");
  return r.ctx;
}
