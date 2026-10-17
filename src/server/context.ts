import "server-only";
import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, grades, members, users } from "@/db/schema";
import { can, type PermissionKey, type Permissions } from "@/lib/permissions";

export type AppContext = {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  business: { id: string; name: string; slug: string; businessType: string | null; timezone: string };
  member: { id: string; isOwner: boolean };
  permissions: Permissions | null;
  can: (key: PermissionKey) => boolean;
};

/**
 * Contexte de la requête : utilisateur connecté + établissement actif + ses droits.
 *
 * Étape actuelle (fondations) : l'authentification n'est pas encore branchée, on prend
 * le propriétaire du premier établissement — c'est ce que crée `npm run db:seed`.
 * L'étape « Comptes & connexion » remplacera uniquement la sélection de l'utilisateur
 * (lecture de la session) ; le reste de la fonction ne change pas.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const row = await db
    .select({ user: users, business: businesses, member: members, permissions: grades.permissions })
    .from(members)
    .innerJoin(businesses, eq(businesses.id, members.businessId))
    .innerJoin(users, eq(users.id, members.userId))
    .leftJoin(grades, eq(grades.id, members.gradeId))
    .where(and(eq(members.isOwner, true), eq(members.status, "active"), isNull(businesses.deletedAt)))
    .orderBy(asc(businesses.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!row) return null;
  const isOwner = row.member.isOwner;
  const permissions = row.permissions ?? null;

  return {
    user: { id: row.user.id, name: row.user.fullName, email: row.user.email, avatarUrl: row.user.avatarUrl },
    business: { id: row.business.id, name: row.business.name, slug: row.business.slug, businessType: row.business.businessType, timezone: row.business.timezone },
    member: { id: row.member.id, isOwner },
    permissions,
    can: (key) => can(permissions, key, isOwner),
  };
});

/** Pour les pages et actions : contexte obligatoire, sinon erreur explicite. */
export async function requireContext(permission?: PermissionKey): Promise<AppContext> {
  const ctx = await getAppContext();
  if (!ctx) throw new Error("Aucun établissement trouvé. Lancez `npm run db:seed` pour créer l'établissement de démonstration.");
  if (permission && !ctx.can(permission)) throw new Error("Vous n'avez pas accès à cette section.");
  return ctx;
}
