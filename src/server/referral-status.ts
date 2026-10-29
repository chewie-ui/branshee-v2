import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { referralCredits, users } from "@/db/schema";
import { referralMonths } from "@/lib/referral";

/** Parrainage : filleuls payants et mois offerts (lecture seule, jamais exposée comme action publique). */
export async function referralStatus(userId: string) {
  const [years, [credit]] = await Promise.all([
    db
      .select({ year: sql<number>`extract(year from ${users.referralPaidAt})::int`, n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.referredById, userId), isNotNull(users.referralPaidAt)))
      .groupBy(sql`1`),
    db.select().from(referralCredits).where(eq(referralCredits.userId, userId)),
  ]);
  const paying = years.reduce((a, y) => a + y.n, 0);
  const earned = referralMonths(years.map((y) => y.n));
  const claimed = credit?.monthsClaimed ?? 0;
  return { paying, earned, claimed, claimable: Math.max(0, earned - claimed) };
}
