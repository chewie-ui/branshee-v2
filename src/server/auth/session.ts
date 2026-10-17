import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "bs_session";
export const BUSINESS_COOKIE = "bs_business";
const SESSION_DAYS = 30;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/**
 * Le cookie contient un jeton aléatoire ; la base ne stocke que son empreinte SHA-256.
 * Une fuite de la table `sessions` ne permet donc pas de se connecter.
 */
export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt, userAgent: meta.userAgent ?? null, ip: meta.ip ?? null });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Utilisateur de la session courante, ou null. */
export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.disabledAt) return null;
  return row;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
  jar.delete(BUSINESS_COOKIE);
}

/* ── Double authentification : étape intermédiaire entre le mot de passe et la session ── */

const PENDING_COOKIE = "bs_2fa";
const PENDING_MIN = 10;
const pendingKey = () => createHash("sha256").update(`2fa:${process.env.DATA_ENCRYPTION_KEY ?? "dev"}`).digest();

/** Mot de passe correct, code à 6 chiffres attendu : cookie signé de 10 minutes, sans session. */
export async function setPendingTwoFactor(userId: string, next: string | null) {
  const exp = Date.now() + PENDING_MIN * 60000;
  const payload = Buffer.from(JSON.stringify({ u: userId, e: exp, n: next })).toString("base64url");
  const sig = createHmac("sha256", pendingKey()).update(payload).digest("base64url");
  (await cookies()).set(PENDING_COOKIE, `${payload}.${sig}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: PENDING_MIN * 60 });
}

export async function getPendingTwoFactor(): Promise<{ userId: string; next: string | null } | null> {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", pendingKey()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; e: number; n: string | null };
    return v.e > Date.now() ? { userId: v.u, next: v.n } : null;
  } catch {
    return null;
  }
}

export async function clearPendingTwoFactor() {
  (await cookies()).delete(PENDING_COOKIE);
}

/** Ferme toutes les sessions d'un compte (changement de mot de passe, d'email, suppression). */
export async function destroyAllSessions(userId: string, keepCurrent = false) {
  const token = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  const all = await db.select({ id: sessions.id, tokenHash: sessions.tokenHash }).from(sessions).where(eq(sessions.userId, userId));
  const keep = token ? sha256(token) : null;
  for (const s of all) if (s.tokenHash !== keep) await db.delete(sessions).where(eq(sessions.id, s.id));
}
