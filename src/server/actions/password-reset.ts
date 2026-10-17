"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users, verificationCodes } from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export type ResetState = { step: "email" | "code"; email?: string; error?: string; info?: string } | undefined;

/**
 * Étape 1 : envoi d'un code à 6 chiffres.
 * La réponse est identique que le compte existe ou non (pas de découverte d'adresses).
 */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { step: "email", error: "Adresse email invalide." };
  const email = parsed.data;
  const client = await ip();
  if (!rateLimit(`reset:${client}`, 10, 3600_000).ok || !rateLimit(`reset:${email}`, 3, 900_000).ok) {
    return { step: "email", error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const [user] = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(and(sql`lower(${users.email}) = ${email}`, isNull(users.disabledAt)));
  if (user) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    // Un seul code actif à la fois : les précédents sont invalidés.
    await db.update(verificationCodes).set({ usedAt: new Date() }).where(and(eq(verificationCodes.email, email), eq(verificationCodes.purpose, "password_reset"), isNull(verificationCodes.usedAt)));
    await db.insert(verificationCodes).values({ userId: user.id, email, purpose: "password_reset", codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60000) });
    const mail = emails.passwordResetCode(user.fullName, code);
    await sendEmail({ ...mail, to: email, template: "password_reset" });
  }
  return { step: "code", email, info: `Si un compte existe pour ${email}, un code vient d'y être envoyé.` };
}

const resetSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Le code contient 6 chiffres."),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(200),
});

/** Étape 2 : vérification du code puis nouveau mot de passe ; toutes les sessions ouvertes sont fermées. */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const raw = { email: String(formData.get("email") ?? "").trim().toLowerCase(), code: String(formData.get("code") ?? "").replace(/\s/g, ""), password: String(formData.get("password") ?? "") };
  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) return { step: "code", email: raw.email, error: parsed.error.issues[0]!.message };
  const { email, code, password } = parsed.data;

  const [entry] = await db
    .select()
    .from(verificationCodes)
    .where(and(eq(verificationCodes.email, email), eq(verificationCodes.purpose, "password_reset"), isNull(verificationCodes.usedAt), gt(verificationCodes.expiresAt, new Date())))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  const invalid: ResetState = { step: "code", email, error: "Code incorrect ou expiré." };
  if (!entry || !entry.userId) return invalid;
  if (entry.attempts >= MAX_ATTEMPTS) return { step: "email", error: "Trop d'essais. Demandez un nouveau code." };

  const a = Buffer.from(entry.codeHash, "hex");
  const b = Buffer.from(hashCode(email, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(verificationCodes).set({ attempts: entry.attempts + 1 }).where(eq(verificationCodes.id, entry.id));
    return invalid;
  }

  const userId = entry.userId;
  await db.transaction(async (tx) => {
    await tx.update(verificationCodes).set({ usedAt: new Date() }).where(eq(verificationCodes.id, entry.id));
    await tx.update(users).set({ passwordHash: await hashPassword(password), sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
  const h = await headers();
  await createSession(userId, { ip: await ip(), userAgent: h.get("user-agent") });
  redirect("/app");
}
