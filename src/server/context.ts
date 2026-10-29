import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, grades, members } from "@/db/schema";
import { can, type PermissionKey, type Permissions } from "@/lib/permissions";
import { BUSINESS_COOKIE, getSessionUser } from "@/server/auth/session";
import { apiAuth } from "@/server/api/als";
import { isLocked } from "@/server/plan";
import { APPS, appForPath } from "@/lib/apps";

export type AppContext = {
  user: { id: string; name: string; email: string; avatarUrl: string | null; isDemo?: boolean };
  business: { id: string; name: string; slug: string; businessType: string | null; timezone: string; brand: string | null };
  member: { id: string; isOwner: boolean };
  /** Tous les établissements dont l'utilisateur est membre actif (pour le sélecteur). */
  businesses: { id: string; name: string; businessType: string | null }[];
  permissions: Permissions | null;
  can: (key: PermissionKey) => boolean;
  /** Apps ouvertes à ce membre par son grade (null = toutes). */
  appAccess: string[] | null;
  canApp: (appId: string) => boolean;
  /** Session ouverte par l'équipe Branshee (supervision acceptée par le pro). */
  impersonating: boolean;
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
  const user = { id: u.id, name: u.fullName, email: u.email, avatarUrl: u.avatarUrl, isDemo: u.isDemo };

  const rows = await db
    .select({ business: businesses, member: members, permissions: grades.permissions, appAccess: grades.appAccess })
    .from(members)
    .innerJoin(businesses, eq(businesses.id, members.businessId))
    .leftJoin(grades, eq(grades.id, members.gradeId))
    .where(and(eq(members.userId, u.id), eq(members.status, "active"), eq(members.isActive, true), isNull(businesses.deletedAt)))
    .orderBy(asc(businesses.createdAt));

  if (rows.length === 0) return { kind: "no-business", user };

  const api = apiAuth.getStore();
  const wanted = api ? api.businessId : (await cookies()).get(BUSINESS_COOKIE)?.value;
  const row = rows.find((r) => r.business.id === wanted) ?? rows[0]!;
  const isOwner = row.member.isOwner;
  const permissions = row.permissions ?? null;
  const appAccess = isOwner ? null : (row.appAccess ?? null);

  return {
    kind: "ok",
    ctx: {
      user,
      business: { id: row.business.id, name: row.business.name, slug: row.business.slug, businessType: row.business.businessType, timezone: row.business.timezone, brand: row.business.brand },
      member: { id: row.member.id, isOwner },
      businesses: rows.map((r) => ({ id: r.business.id, name: r.business.name, businessType: r.business.businessType })),
      permissions,
      can: (key) => can(permissions, key, isOwner),
      appAccess,
      canApp: (appId) => !appAccess || appAccess.includes(appId),
      impersonating: !!session.impersonatedById,
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
/**
 * Contexte obligatoire. Pendant une action (envoi de formulaire, bouton…), un espace Skydev en lecture seule
 * (essai terminé sans abonnement) est renvoyé vers l'abonnement, sauf pour les actions marquées `allowLocked`
 * (s'abonner, choisir un établissement…). Sûr par défaut : toute nouvelle action est bloquée.
 */
export async function requireContext(permission?: PermissionKey, opts: { allowLocked?: boolean; app?: string; write?: boolean } = {}): Promise<AppContext> {
  const r = await resolveContext();
  if (r.kind === "anonymous") redirect("/connexion");
  if (r.kind === "no-business") redirect("/bienvenue");
  if (permission && !r.ctx.can(permission)) redirect("/app/acces-refuse");
  // App fermée à ce grade (ex. un comptable sans accès à RDV) : pages et actions refusées.
  if (opts.app && !r.ctx.canApp(opts.app)) redirect("/app/acces-refuse");
  // Toute page (et toute navigation interne) d'une app fermée au grade : refusée côté serveur, avant de lire la moindre donnée.
  if (r.ctx.appAccess) {
    const path = (await headers()).get("x-pathname") ?? "";
    const app = path.startsWith("/app/") && path !== "/app/acces-refuse" ? appForPath(APPS, path) : null;
    if (app && app.id !== "reglages" && !r.ctx.canApp(app.id)) redirect("/app/acces-refuse");
  }
  // Lecture seule (essai Skydev terminé) : toute action d'app ou d'écriture (`app` ou `write`) envoyée en POST est refusée,
  // qu'elle vienne d'un bouton, d'un formulaire sans JavaScript ou de l'API. Les pages (GET et rendu après une action) passent.
  if ((opts.app || opts.write) && !opts.allowLocked) {
    const method = (await headers()).get("x-method") ?? "POST";
    if (method !== "GET" && method !== "HEAD" && (await isLocked(r.ctx.business.id, r.ctx.business.brand))) redirect("/app/reglages/abonnement?bloque=1");
  }
  return r.ctx;
}

/** Les réglages de sécurité du compte (mot de passe, email, 2FA, suppression) sont interdits en supervision. */
export async function isImpersonating() {
  const s = await getSessionUser();
  return !!s?.impersonatedById;
}

/** Contexte sans redirection (API de l'application) : null si pas connecté ou sans établissement. */
export async function currentContext(): Promise<AppContext | null> {
  const r = await resolveContext();
  return r.kind === "ok" ? r.ctx : null;
}
