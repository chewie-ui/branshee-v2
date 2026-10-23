import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { verificationCodes } from "@/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";

/**
 * Codes à 6 chiffres envoyés par email (vérification d'adresse, changement d'email,
 * suppression de compte). Hachés en base, 15 minutes, 5 essais, un seul actif par usage.
 */
type Purpose = "email_verification" | "email_change" | "account_deletion";
const TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const hash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");

export async function issueCode(user: { id: string; name: string }, email: string, purpose: Purpose) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const target = email.toLowerCase();
  await db.update(verificationCodes).set({ usedAt: new Date() }).where(and(eq(verificationCodes.userId, user.id), eq(verificationCodes.purpose, purpose), isNull(verificationCodes.usedAt)));
  await db.insert(verificationCodes).values({ userId: user.id, email: target, purpose, codeHash: hash(target, code), expiresAt: new Date(Date.now() + TTL_MIN * 60000) });
  await sendEmail({ ...emails.verificationCode(user.name, code, purpose), to: target, template: purpose });
}

/** Vérifie le code ; renvoie l'adresse visée (utile pour un changement d'email) ou une erreur. */
export async function consumeCode(userId: string, purpose: Purpose, code: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false, error: "Le code contient 6 chiffres." };
  const [entry] = await db
    .select()
    .from(verificationCodes)
    .where(and(eq(verificationCodes.userId, userId), eq(verificationCodes.purpose, purpose), isNull(verificationCodes.usedAt), gt(verificationCodes.expiresAt, new Date())))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (!entry) return { ok: false, error: "Code expiré. Demandez-en un nouveau." };
  // L'essai est réservé AVANT la comparaison, de façon atomique : des essais envoyés en parallèle ne peuvent pas dépasser la limite.
  const [slot] = await db
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(and(eq(verificationCodes.id, entry.id), lt(verificationCodes.attempts, MAX_ATTEMPTS), isNull(verificationCodes.usedAt)))
    .returning({ attempts: verificationCodes.attempts });
  if (!slot) return { ok: false, error: "Trop d'essais. Demandez un nouveau code." };
  const a = Buffer.from(entry.codeHash, "hex");
  const b = Buffer.from(hash(entry.email, clean), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Code incorrect." };
  const [used] = await db.update(verificationCodes).set({ usedAt: new Date() }).where(and(eq(verificationCodes.id, entry.id), isNull(verificationCodes.usedAt))).returning({ id: verificationCodes.id });
  if (!used) return { ok: false, error: "Code déjà utilisé. Demandez-en un nouveau." };
  return { ok: true, email: entry.email };
}


/** Réserve un essai sur un code (atomique) ; `false` si la limite d'essais est atteinte ou le code déjà utilisé. */
export async function reserveCodeAttempt(id: string, max = MAX_ATTEMPTS) {
  const [slot] = await db
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(and(eq(verificationCodes.id, id), lt(verificationCodes.attempts, max), isNull(verificationCodes.usedAt)))
    .returning({ id: verificationCodes.id });
  return !!slot;
}

/** Marque un code comme utilisé ; `false` s'il l'était déjà (deux requêtes simultanées). */
export async function markCodeUsed(id: string) {
  const [used] = await db.update(verificationCodes).set({ usedAt: new Date() }).where(and(eq(verificationCodes.id, id), isNull(verificationCodes.usedAt))).returning({ id: verificationCodes.id });
  return !!used;
}
