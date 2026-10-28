import "server-only";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { referralCredits, users } from "@/db/schema";

/** Parrainage : filleuls payants et mois offerts (lecture seule, jamais exposée comme action publique). */
export async function referralStatus(userId: string) {
  const [[{ paying }], [credit]] = await Promise.all([
    db.select({ paying: count() }).from(users).where(and(eq(users.referredById, userId), isNotNull(users.referralPaidAt))),
    db.select().from(referralCredits).where(eq(referralCredits.userId, userId)),
  ]);
  const earned = Math.floor(paying / 3) * 2;
  return { paying, claimed: credit?.monthsClaimed ?? 0, claimable: Math.max(0, earned - (credit?.monthsClaimed ?? 0)) };
}
