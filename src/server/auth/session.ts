import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { apiAuth } from "@/server/api/als";

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
export async function getSessionUser(): Promise<{ user: typeof users.$inferSelect; sessionId: string; impersonatedById: string | null } | null> {
  // Requête de l'application (jeton Bearer déjà vérifié par l'API) : pas de cookie.
  const api = apiAuth.getStore();
  if (api) {
    const [user] = await db.select().from(users).where(eq(users.id, api.userId)).limit(1);
    return user && !user.disabledAt ? { user, sessionId: api.sessionId, impersonatedById: null } : null;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, sessionId: sessions.id, impersonatedById: sessions.impersonatedById })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), eq(sessions.kind, "web"), gt(sessions.expiresAt, new Date())))
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

/* ── Supervision : le super-admin ouvre une session au nom d'un pro qui l'a accepté ── */

export const ADMIN_BACKUP_COOKIE = "bs_admin";
const SUPERVISION_HOURS = 2;

/** Ouvre une session « supervisée » (2 h max) et met de côté la session du super-admin. */
export async function startImpersonation(userId: string, adminId: string) {
  const jar = await cookies();
  const adminToken = jar.get(SESSION_COOKIE)?.value;
  if (!adminToken) throw new Error("Session administrateur absente.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SUPERVISION_HOURS * 3600000);
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt, impersonatedById: adminId });
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: expiresAt };
  jar.set(ADMIN_BACKUP_COOKIE, adminToken, opts);
  jar.set(SESSION_COOKIE, token, opts);
  jar.delete(BUSINESS_COOKIE);
}

/** Fin de supervision : la session du pro est supprimée, celle du super-admin restaurée. */
export async function stopImpersonation() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const backup = jar.get(ADMIN_BACKUP_COOKIE)?.value;
  if (token) await db.delete(sessions).where(and(eq(sessions.tokenHash, sha256(token)), isNotNull(sessions.impersonatedById)));
  jar.delete(ADMIN_BACKUP_COOKIE);
  jar.delete(BUSINESS_COOKIE);
  if (backup) jar.set(SESSION_COOKIE, backup, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
  else jar.delete(SESSION_COOKIE);
}

/** Le pro met fin à la supervision : toutes les sessions supervisées de son compte sont fermées. */
export async function endImpersonationsFor(userId: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), isNotNull(sessions.impersonatedById)));
}
