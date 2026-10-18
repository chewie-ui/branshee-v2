import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { slugify } from "@/lib/slug";

/** Code de parrainage personnel, créé à la première demande. */
export async function ensureReferralCode(userId: string, name: string) {
  const [u] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId));
  if (u?.code) return u.code;
  for (let i = 0; i < 5; i++) {
    const code = `${slugify(name).split("-")[0]?.slice(0, 8).toUpperCase() || "PRO"}${randomBytes(2).toString("hex").toUpperCase()}`;
    const done = await db.update(users).set({ referralCode: code }).where(eq(users.id, userId)).returning({ code: users.referralCode }).catch(() => []);
    if (done.length) return code;
  }
  return "";
}
