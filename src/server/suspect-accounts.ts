import "server-only";
import { and, desc, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, members, users } from "@/db/schema";

/**
 * Faux comptes créés par des robots : email jamais confirmé (après plus d'un jour), nom d'un seul mot
 * (« Pxktwyytc », « Xjuda »), aucun établissement, aucune équipe, aucune fiche client. Rien à perdre en les supprimant :
 * un compte sans email confirmé n'a jamais eu accès à rien.
 */
export const suspectWhere = and(
  isNull(users.emailVerifiedAt),
  sql`${users.isSuperadmin} = false`,
  // Nom d'un seul mot (« Xjuda », « Pxktwyytc »)…
  sql`${users.fullName} !~ '\\s'`,
  // … et inscrit depuis plus d'un jour sans jamais avoir confirmé son email (un vrai client confirme tout de suite).
  sql`${users.createdAt} < now() - interval '1 day'`,
  sql`not exists (select 1 from ${businesses} b where b.owner_id = ${users.id})`,
  sql`not exists (select 1 from ${members} m where m.user_id = ${users.id})`,
  sql`not exists (select 1 from ${customers} c where c.user_id = ${users.id})`,
);

export async function suspectAccounts(limit = 500) {
  return db.select({ id: users.id, name: users.fullName, email: users.email, createdAt: users.createdAt }).from(users).where(suspectWhere).orderBy(desc(users.createdAt)).limit(limit);
}
