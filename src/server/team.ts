import "server-only";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";

/**
 * Relie au compte les invitations envoyées à son adresse email.
 * L'invitation reste « en attente » : la personne l'accepte ou la refuse (Mes établissements).
 */
export async function linkInvitations(userId: string, email: string) {
  await db
    .update(members)
    .set({ userId })
    .where(and(isNull(members.userId), sql`lower(${members.inviteEmail}) = ${email.toLowerCase()}`));
}
