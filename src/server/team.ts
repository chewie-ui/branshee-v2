import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, users } from "@/db/schema";

/**
 * Relie au compte les invitations envoyées à son adresse email.
 * L'invitation reste « en attente » : la personne l'accepte ou la refuse (Mes établissements).
 */
export async function linkInvitations(userId: string, email: string) {
  // Seulement une adresse VÉRIFIÉE : sinon, n'importe qui s'inscrivant avec l'email d'un invité récupérerait son accès.
  const [u] = await db.select({ verified: users.emailVerifiedAt, email: users.email }).from(users).where(eq(users.id, userId));
  if (!u?.verified || u.email.toLowerCase() !== email.toLowerCase()) return;
  await db
    .update(members)
    .set({ userId })
    .where(and(isNull(members.userId), sql`lower(${members.inviteEmail}) = ${email.toLowerCase()}`));
}
