import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, users } from "@/db/schema";
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

/**
 * Mention « propulsé par » des pages publiques d'un pro : le lien porte le code de parrainage du titulaire,
 * pour que le pro gagne un mois quand un de ses clients s'abonne depuis sa page.
 */
export async function poweredByFor(businessId: string, brand: { id: string; name: string }) {
  if (brand.id !== "skydev") return undefined;
  const base = (process.env.SKYDEV_APP_URL ?? "https://skydev.be").replace(/\/$/, "");
  const [owner] = await db
    .select({ id: users.id, name: users.fullName })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.businessId, businessId), eq(members.isOwner, true)))
    .limit(1);
  const code = owner ? await ensureReferralCode(owner.id, owner.name).catch(() => "") : "";
  return { name: brand.name, url: code ? `${base}/inscription?ref=${code}` : base };
}
