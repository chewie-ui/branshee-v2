import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

/**
 * Jetons de l'application :
 * - accès : signé (HMAC), 15 minutes, porte l'utilisateur, sa session et sa « génération » (sessionVersion) ;
 * - rafraîchissement : aléatoire, 60 jours, stocké haché dans `sessions` (kind = "api"), renouvelé à chaque usage.
 * Changer de mot de passe ou fermer les sessions supprime les lignes : l'application est déconnectée.
 */
export const ACCESS_TTL_S = 15 * 60;
const REFRESH_DAYS = 60;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const key = () => createHash("sha256").update(`api-access:${process.env.DATA_ENCRYPTION_KEY ?? "dev"}`).digest();
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

type AccessPayload = { u: string; s: string; v: number; e: number };

export async function issueSession(userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const [u] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId));
  const refreshToken = randomBytes(32).toString("base64url");
  const [s] = await db
    .insert(sessions)
    .values({ userId, kind: "api", tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000), userAgent: meta.userAgent?.slice(0, 300) ?? "Application Branshee", ip: meta.ip ?? null })
    .returning({ id: sessions.id });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  return { sessionId: s!.id, tokens: { accessToken: accessFor(userId, s!.id, u?.v ?? 0), refreshToken, tokenType: "Bearer", expiresIn: ACCESS_TTL_S } };
}

export const issueTokens = async (userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) => (await issueSession(userId, meta)).tokens;

function accessFor(userId: string, sessionId: string, version: number) {
  const payload = Buffer.from(JSON.stringify({ u: userId, s: sessionId, v: version, e: Date.now() + ACCESS_TTL_S * 1000 } satisfies AccessPayload)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type AccessCheck = { ok: true; userId: string; sessionId: string } | { ok: false; error: "token_missing" | "token_invalid" | "token_expired" | "token_revoked" };

/** Vérifie un jeton d'accès : signature, expiration, session toujours ouverte, compte actif et même génération. */
export async function verifyAccess(header: string | null): Promise<AccessCheck> {
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { ok: false, error: "token_missing" };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false, error: "token_invalid" };
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, error: "token_invalid" };
  let p: AccessPayload;
  try {
    p = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return { ok: false, error: "token_invalid" };
  }
  if (p.e < Date.now()) return { ok: false, error: "token_expired" };
  const [row] = await db
    .select({ v: users.sessionVersion, disabled: users.disabledAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, p.s), eq(sessions.userId, p.u), eq(sessions.kind, "api"), gt(sessions.expiresAt, new Date())));
  if (!row || row.disabled || row.v !== p.v) return { ok: false, error: "token_revoked" };
  return { ok: true, userId: p.u, sessionId: p.s };
}

/** Échange un jeton de rafraîchissement contre une nouvelle paire (l'ancien devient inutilisable). */
export async function rotateRefresh(refreshToken: string) {
  if (!refreshToken || refreshToken.length > 200) return null;
  const oldHash = sha256(refreshToken);
  const [row] = await db
    .select({ id: sessions.id, userId: sessions.userId, version: users.sessionVersion, disabled: users.disabledAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, oldHash), eq(sessions.kind, "api"), gt(sessions.expiresAt, new Date())));
  if (!row || row.disabled) return null;
  // Même session, nouveau jeton : l'ancien jeton de rafraîchissement ne sert plus, la session garde son identifiant.
  const next = randomBytes(32).toString("base64url");
  const updated = await db
    .update(sessions)
    .set({ tokenHash: sha256(next), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000), updatedAt: new Date() })
    .where(and(eq(sessions.id, row.id), eq(sessions.tokenHash, oldHash)))
    .returning({ id: sessions.id });
  if (!updated.length) return null; // déjà utilisé par une requête concurrente
  return { accessToken: accessFor(row.userId, row.id, row.version), refreshToken: next, tokenType: "Bearer", expiresIn: ACCESS_TTL_S };
}

/** Déconnexion de l'application : ferme la session de ce jeton. */
export async function revokeSession(sessionId: string) {
  await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.kind, "api")));
}

/** Jeton signé à durée courte pour les étapes sans session (double authentification, mot de passe oublié, suppression). */
export function signChallenge(data: Record<string, unknown>, minutes: number) {
  const payload = Buffer.from(JSON.stringify({ ...data, e: Date.now() + minutes * 60000 })).toString("base64url");
  return `${payload}.${sign(`c:${payload}`)}`;
}

export function readChallenge<T extends Record<string, unknown>>(token: unknown): (T & { e: number }) | null {
  if (typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(`c:${payload}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { e: number };
    return v.e > Date.now() ? v : null;
  } catch {
    return null;
  }
}
