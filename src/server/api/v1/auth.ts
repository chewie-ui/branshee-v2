import "server-only";
import { createHash, createPublicKey, createVerify, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { loginEvents, sessions, users, verificationCodes } from "@/db/schema";
import { burnPasswordCheck, hashPassword, isLegacyHash, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import { decrypt } from "@/lib/field-crypto";
import { verifyTotp } from "@/lib/totp";
import { linkInvitations } from "@/server/team";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { apiAuth } from "@/server/api/als";
import { issueSession, readChallenge, revokeSession, rotateRefresh, signChallenge } from "@/server/api/tokens";
import { fail, invalid, str, type Route } from "@/server/api/http";
import { authPayload, userProfile, appContext } from "@/server/api/v1/shared";

async function meta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: h.get("user-agent") };
}

/** Ouvre une session d'application et renvoie jetons + profil + contexte. */
async function signIn(userId: string, method: "password" | "two_factor" | "google" | "apple", extra: Record<string, unknown> = {}) {
  const m = await meta();
  const { tokens, sessionId } = await issueSession(userId, { userAgent: m.userAgent ? `Application · ${m.userAgent}` : "Application Branshee", ip: m.ip });
  await db.insert(loginEvents).values({ userId, method, ip: m.ip });
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (u) await linkInvitations(userId, u.email);
  return apiAuth.run({ userId, sessionId, businessId: null }, async () => ({ ...(await authPayload(tokens, userId)), ...extra }));
}

const emailSchema = z.email().transform((e) => e.toLowerCase());

async function login(body: Record<string, unknown>) {
  const email = emailSchema.safeParse(str(body.email, 200));
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.success || !password) return fail(400, "missing_credentials", "Email et mot de passe requis.");
  const m = await meta();
  const limit = rateLimit(`login:${m.ip}:${email.data}`, 8, 15 * 60 * 1000);
  if (!limit.ok) return fail(429, "rate_limited", `Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfterSec / 60)} min.`);
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.data}`);
  if (!user) {
    await burnPasswordCheck(password);
    return fail(401, "invalid_credentials", "Email ou mot de passe incorrect.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) return fail(401, "invalid_credentials", "Email ou mot de passe incorrect.");
  if (user.disabledAt) return fail(403, "account_disabled", "Ce compte a été désactivé.");
  if (isLegacyHash(user.passwordHash)) await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  if (user.twoFactorSecret) return { twoFactorRequired: true, challengeToken: signChallenge({ k: "2fa", u: user.id }, 5) };
  return signIn(user.id, "password");
}

async function verify2fa(body: Record<string, unknown>) {
  const c = readChallenge<{ k: string; u: string }>(body.challengeToken);
  if (!c || c.k !== "2fa") return fail(401, "challenge_expired", "Délai dépassé. Reconnectez-vous.");
  if (!rateLimit(`2fa:${c.u}`, 6, 10 * 60 * 1000).ok) return fail(429, "rate_limited", "Trop d'essais. Reconnectez-vous dans quelques minutes.");
  const [user] = await db.select().from(users).where(eq(users.id, c.u));
  if (!user || user.disabledAt || !user.twoFactorSecret) return fail(401, "challenge_expired", "Reconnectez-vous.");
  let secret: string | null = null;
  try {
    secret = decrypt(user.twoFactorSecret);
  } catch {
    return fail(500, "two_factor_unreadable", "Double authentification illisible : contactez le support.");
  }
  if (!secret || !verifyTotp(secret, str(body.code, 12))) return fail(401, "invalid_code", "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez.");
  return signIn(user.id, "two_factor");
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(200),
});

async function register(body: Record<string, unknown>) {
  const parsed = registerSchema.safeParse({ fullName: str(body.fullName, 200), email: str(body.email, 200), password: typeof body.password === "string" ? body.password : "" });
  if (!parsed.success) return invalid(parsed.error.issues[0]!.message, { field: String(parsed.error.issues[0]!.path[0]) });
  if (typeof body.confirmPassword === "string" && body.confirmPassword !== parsed.data.password) return invalid("Les mots de passe ne correspondent pas.", { field: "confirmPassword" });
  const m = await meta();
  if (!rateLimit(`register:${m.ip}`, 10, 60 * 60 * 1000).ok) return fail(429, "rate_limited", "Trop de tentatives. Réessayez dans une heure.");
  const { fullName, email, password } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (existing) return fail(409, "email_taken", "Un compte existe déjà avec cet email. Connectez-vous.");
  const [user] = await db.insert(users).values({ fullName, email, passwordHash: await hashPassword(password), signupIntent: body.accountIntent === "client" ? "client" : "pro" }).returning({ id: users.id });
  return signIn(user!.id, "password");
}

/* ── Google et Apple : le jeton est vérifié côté serveur, puis rattaché au compte (ou un compte est créé) ── */

async function findOrCreateSocial(kind: "google" | "apple", sub: string, email: string | null, name: string, intent: unknown) {
  const col = kind === "google" ? users.googleId : users.appleId;
  let [user] = await db.select().from(users).where(eq(col, sub));
  if (!user && email) {
    [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
    if (user) await db.update(users).set(kind === "google" ? { googleId: sub } : { appleId: sub }).where(eq(users.id, user.id));
  }
  if (user?.disabledAt) return fail(403, "account_disabled", "Ce compte a été désactivé.");
  if (user) return { id: user.id, created: false };
  if (!email) return fail(400, "email_required", "Adresse email indisponible : autorisez son partage pour créer votre compte.");
  const [created] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), fullName: name.trim().slice(0, 120) || email.split("@")[0]!, emailVerifiedAt: new Date(), signupIntent: intent === "client" ? "client" : "pro", ...(kind === "google" ? { googleId: sub } : { appleId: sub }) })
    .returning({ id: users.id });
  return { id: created!.id, created: true };
}

async function google(body: Record<string, unknown>) {
  const idToken = str(body.idToken, 4000);
  if (!idToken) return invalid("Jeton Google manquant.");
  const audiences = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_ID_IOS, process.env.GOOGLE_CLIENT_ID_ANDROID, process.env.GOOGLE_CLIENT_ID_WEB].filter(Boolean);
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  const info = res?.ok ? ((await res.json()) as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; exp?: string }) : null;
  const ok = info && info.sub && audiences.includes(info.aud ?? "") && ["accounts.google.com", "https://accounts.google.com"].includes(info.iss ?? "") && Number(info.exp ?? 0) * 1000 > Date.now();
  if (!ok) return fail(401, "invalid_google_token", "Connexion Google refusée.");
  const verified = info.email_verified === true || info.email_verified === "true";
  const { id, created } = await findOrCreateSocial("google", info.sub!, verified ? (info.email ?? null) : null, info.name ?? "", body.accountIntent);
  return signIn(id, "google", { created });
}

let appleKeys: { keys: { kid: string; kty: string; n: string; e: string; alg?: string }[]; at: number } | null = null;
async function appleKey(kid: string) {
  const fresh = appleKeys && Date.now() - appleKeys.at < 86400000;
  if (!fresh || !appleKeys!.keys.some((k) => k.kid === kid)) {
    const r = await fetch("https://appleid.apple.com/auth/keys", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("apple_keys");
    appleKeys = { keys: ((await r.json()) as { keys: NonNullable<typeof appleKeys>["keys"] }).keys, at: Date.now() };
  }
  return appleKeys!.keys.find((k) => k.kid === kid) ?? null;
}

async function verifyApple(token: string) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { kid?: string; alg?: string };
  if (header.alg !== "RS256" || !header.kid) return null;
  const jwk = await appleKey(header.kid);
  if (!jwk) return null;
  const valid = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
  if (!valid) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as { iss?: string; aud?: string; exp?: number; sub?: string; email?: string };
  const audiences = [process.env.APPLE_BUNDLE_ID || "com.branshee.pro", process.env.APPLE_SERVICE_ID].filter(Boolean);
  if (payload.iss !== "https://appleid.apple.com" || !audiences.includes(payload.aud ?? "") || (payload.exp ?? 0) * 1000 < Date.now() || !payload.sub) return null;
  return payload;
}

async function apple(body: Record<string, unknown>) {
  const token = str(body.identityToken, 4000);
  const payload = token ? await verifyApple(token).catch(() => null) : null;
  if (!payload) return fail(401, "invalid_apple_token", "Connexion Apple refusée.");
  const { id, created } = await findOrCreateSocial("apple", payload.sub!, payload.email ?? null, str(body.fullName, 120), body.accountIntent);
  return signIn(id, "apple", { created });
}

/* ── Mot de passe oublié en trois étapes (code par email) ── */

const codeHash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");

async function forgot(body: Record<string, unknown>) {
  const email = emailSchema.safeParse(str(body.email, 200));
  if (!email.success) return invalid("Adresse email invalide.");
  const m = await meta();
  if (!rateLimit(`reset:${m.ip}`, 10, 3600_000).ok || !rateLimit(`reset:${email.data}`, 3, 900_000).ok) return fail(429, "rate_limited", "Trop de demandes. Réessayez dans quelques minutes.");
  const [user] = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(and(sql`lower(${users.email}) = ${email.data}`, isNull(users.disabledAt)));
  if (user) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.update(verificationCodes).set({ usedAt: new Date() }).where(and(eq(verificationCodes.email, email.data), eq(verificationCodes.purpose, "password_reset"), isNull(verificationCodes.usedAt)));
    await db.insert(verificationCodes).values({ userId: user.id, email: email.data, purpose: "password_reset", codeHash: codeHash(email.data, code), expiresAt: new Date(Date.now() + 15 * 60000) });
    await sendEmail({ ...emails.passwordResetCode(user.fullName, code), to: email.data, template: "password_reset" });
  }
  // Réponse identique que le compte existe ou non.
  return { ok: true, resetToken: signChallenge({ k: "reset", em: email.data }, 15), expiresIn: 900 };
}

async function forgotVerify(body: Record<string, unknown>) {
  const c = readChallenge<{ k: string; em: string }>(body.resetToken);
  if (!c || c.k !== "reset") return fail(401, "reset_expired", "Délai dépassé. Recommencez.");
  const code = str(body.code, 12).replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return invalid("Le code contient 6 chiffres.");
  const [entry] = await db
    .select()
    .from(verificationCodes)
    .where(and(eq(verificationCodes.email, c.em), eq(verificationCodes.purpose, "password_reset"), isNull(verificationCodes.usedAt), gt(verificationCodes.expiresAt, new Date())))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (!entry?.userId) return fail(400, "invalid_code", "Code incorrect ou expiré.");
  if (entry.attempts >= 5) return fail(400, "too_many_attempts", "Trop d'essais. Demandez un nouveau code.");
  const a = Buffer.from(entry.codeHash, "hex");
  const b = Buffer.from(codeHash(c.em, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(verificationCodes).set({ attempts: entry.attempts + 1 }).where(eq(verificationCodes.id, entry.id));
    return fail(400, "invalid_code", "Code incorrect ou expiré.");
  }
  await db.update(verificationCodes).set({ usedAt: new Date() }).where(eq(verificationCodes.id, entry.id));
  return { ok: true, resetToken: signChallenge({ k: "reset-ok", u: entry.userId }, 15) };
}

async function forgotReset(body: Record<string, unknown>) {
  const c = readChallenge<{ k: string; u: string }>(body.resetToken);
  if (!c || c.k !== "reset-ok") return fail(401, "reset_expired", "Délai dépassé. Recommencez.");
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 10 || password.length > 200) return invalid("Le mot de passe doit contenir au moins 10 caractères.", { field: "password" });
  if (typeof body.confirmPassword === "string" && body.confirmPassword !== password) return invalid("Les mots de passe ne correspondent pas.", { field: "confirmPassword" });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(password), sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, c.u));
    await tx.delete(sessions).where(eq(sessions.userId, c.u));
  });
  return { ok: true };
}

export const authRoutes: Route[] = [
  { method: "GET", path: "/health", public: true, handler: async () => ({ ok: true, version: "v2" }) },
  { method: "POST", path: "/auth/login", public: true, handler: (r) => login(r.body) },
  { method: "POST", path: "/auth/2fa", public: true, handler: (r) => verify2fa(r.body) },
  { method: "POST", path: "/auth/register", public: true, handler: (r) => register(r.body) },
  { method: "POST", path: "/auth/google", public: true, handler: (r) => google(r.body) },
  { method: "POST", path: "/auth/apple", public: true, handler: (r) => apple(r.body) },
  {
    method: "POST",
    path: "/auth/refresh",
    public: true,
    handler: async (r) => (await rotateRefresh(str(r.body.refreshToken, 200))) ?? fail(401, "invalid_refresh_token", "Session expirée. Reconnectez-vous."),
  },
  { method: "POST", path: "/auth/forgot-password", public: true, handler: (r) => forgot(r.body) },
  { method: "POST", path: "/auth/forgot-password/verify", public: true, handler: (r) => forgotVerify(r.body) },
  { method: "POST", path: "/auth/forgot-password/reset", public: true, handler: (r) => forgotReset(r.body) },
  { method: "GET", path: "/auth/me", handler: async (r) => ({ user: await userProfile(r.auth!.userId), context: await appContext(r.auth!.userId) }) },
  {
    method: "POST",
    path: "/auth/logout",
    handler: async (r) => {
      await revokeSession(r.auth!.sessionId);
      return { ok: true };
    },
  },
];
