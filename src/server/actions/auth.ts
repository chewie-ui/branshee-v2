"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { loginEvents, users } from "@/db/schema";
import { burnPasswordCheck, hashPassword, isLegacyHash, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import { createSession, destroySession } from "@/server/auth/session";
import { linkInvitations } from "@/server/team";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

async function clientMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null, userAgent: h.get("user-agent") };
}

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

/** Évite les redirections ouvertes : seuls les chemins internes de l'espace pro sont acceptés. */
function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return /^\/app(\/[\w\-/?=&%.]*)?$/.test(v) ? v : "/app";
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  password: z.string().min(10, "10 caractères minimum.").max(200),
});

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { fullName: String(formData.get("fullName") ?? ""), email: String(formData.get("email") ?? "").trim(), password: String(formData.get("password") ?? "") };
  const values = { fullName: raw.fullName, email: raw.email };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const meta = await clientMeta();
  if (!rateLimit(`register:${meta.ip}`, 10, 60 * 60 * 1000).ok) return { error: "Trop de tentatives. Réessayez dans une heure.", values };

  const { fullName, email, password } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (existing) return { fieldErrors: { email: "Un compte existe déjà avec cet email. Connectez-vous." }, values };

  const [user] = await db.insert(users).values({ fullName, email, passwordHash: await hashPassword(password) }).returning({ id: users.id });
  await createSession(user!.id, meta);
  await db.insert(loginEvents).values({ userId: user!.id, method: "password", ip: meta.ip });
  // Invité par un établissement ? Il arrive directement dans son espace, sans créer d'établissement.
  await linkInvitations(user!.id, email);
  redirect("/app");
}

const loginSchema = z.object({
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { email: String(formData.get("email") ?? "").trim(), password: String(formData.get("password") ?? "") };
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const meta = await clientMeta();
  const { email, password } = parsed.data;
  const limit = rateLimit(`login:${meta.ip}:${email}`, 8, 15 * 60 * 1000);
  if (!limit.ok) return { error: `Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfterSec / 60)} min.`, values };

  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  if (!user) {
    await burnPasswordCheck(password);
    return { error: "Email ou mot de passe incorrect.", values };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { error: "Email ou mot de passe incorrect.", values };
  if (user.disabledAt) return { error: "Ce compte est désactivé. Contactez le support.", values };
  // Compte repris de l'ancien Branshee : on remplace le hash bcrypt par un hash scrypt.
  if (isLegacyHash(user.passwordHash)) await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));

  await createSession(user.id, meta);
  await db.insert(loginEvents).values({ userId: user.id, method: "password", ip: meta.ip });
  await linkInvitations(user.id, email);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}

