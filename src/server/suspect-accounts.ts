import "server-only";
import { and, desc, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, members, users } from "@/db/schema";

/**
 * Faux comptes créés par des robots : email jamais confirmé, nom d'un seul mot tapé au hasard (4 consonnes
 * d'affilée, ex. « Pxktwyytc »), aucun établissement, aucune équipe, aucune fiche client. Rien à perdre en les supprimant.
 */
export const suspectWhere = and(
  isNull(users.emailVerifiedAt),
  sql`${users.isSuperadmin} = false`,
  sql`${users.fullName} !~ '\\s'`,
  sql`${users.fullName} ~* '[bcdfghjklmnpqrstvwxz]{4,}'`,
  sql`not exists (select 1 from ${businesses} b where b.owner_id = ${users.id})`,
  sql`not exists (select 1 from ${members} m where m.user_id = ${users.id})`,
  sql`not exists (select 1 from ${customers} c where c.user_id = ${users.id})`,
);

export async function suspectAccounts(limit = 500) {
  return db.select({ id: users.id, name: users.fullName, email: users.email, createdAt: users.createdAt }).from(users).where(suspectWhere).orderBy(desc(users.createdAt)).limit(limit);
}
