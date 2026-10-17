import "server-only";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";

/** Relie au compte les places de membre réservées avec son adresse email (invitations). */
export async function linkInvitations(userId: string, email: string) {
  await db
    .update(members)
    .set({ userId, status: "active", joinedAt: new Date() })
    .where(and(isNull(members.userId), sql`lower(${members.inviteEmail}) = ${email.toLowerCase()}`));
}
