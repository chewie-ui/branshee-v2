"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/field-crypto";
import { generateSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import { destroyAllSessions, destroySession, getSessionUser } from "@/server/auth/session";
import { linkCustomerRecords } from "@/server/client-account";
import { consumeCode, issueCode } from "@/server/codes";
import { deletePublicImage, savePublicImage } from "@/server/storage";
import { isImpersonating } from "@/server/context";
import { deleteUserAccount } from "@/server/account-deletion";
import { linkInvitations } from "@/server/team";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function me() {
  const s = await getSessionUser();
  if (!s) redirect("/connexion");
  return s.user;
}

const internal = (s: string | null | undefined) => (s && /^\/(?!\/)[\w\-/?=&%.]*$/.test(s) ? s : null);

/* ───────────── Vérification de l'adresse email ───────────── */

export async function resendVerification(): Promise<Result> {
  const u = await me();
  if (u.emailVerifiedAt) return { ok: true, message: "Adresse déjà vérifiée." };
  if (!rateLimit(`verify-send:${u.id}`, 4, 15 * 60 * 1000).ok) return { ok: false, error: "Trop de demandes. Réessayez dans quelques minutes." };
  await issueCode({ id: u.id, name: u.fullName }, u.email, "email_verification");
  return { ok: true, message: `Un nouveau code a été envoyé à ${u.email}.` };
}

export async function verifyEmail(_prev: Result | undefined, fd: FormData): Promise<Result> {
  const u = await me();
  if (!rateLimit(`verify:${u.id}`, 10, 15 * 60 * 1000).ok) return { ok: false, error: "Trop d'essais. Réessayez plus tard." };
  const res = await consumeCode(u.id, "email_verification", String(fd.get("code") ?? ""));
  if (!res.ok) return res;
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, u.id));
  await linkCustomerRecords(u.id, u.email);
  await linkInvitations(u.id, u.email);
  redirect(internal(String(fd.get("next") ?? "")) ?? "/espace-client");
}

/* ───────────── Profil ───────────── */

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  phone: z.string().trim().max(40),
  gender: z.enum(["", "female", "male", "other"]),
  birthDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")]),
  address: z.string().trim().max(160),
  postalCode: z.string().trim().max(12),
  city: z.string().trim().max(80),
  country: z.string().trim().max(60),
  emailNotifications: z.boolean(),
});

export async function updateProfile(fd: FormData): Promise<Result> {
  const u = await me();
  const parsed = profileSchema.safeParse({
    fullName: String(fd.get("fullName") ?? ""),
    phone: String(fd.get("phone") ?? ""),
    gender: String(fd.get("gender") ?? ""),
    birthDate: String(fd.get("birthDate") ?? ""),
    address: String(fd.get("address") ?? ""),
    postalCode: String(fd.get("postalCode") ?? ""),
    city: String(fd.get("city") ?? ""),
    country: String(fd.get("country") ?? ""),
    emailNotifications: fd.get("emailNotifications") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  if (v.birthDate && (v.birthDate > new Date().toISOString().slice(0, 10) || v.birthDate < "1900-01-01")) return { ok: false, error: "Date de naissance invalide." };

  let avatar: string | null | undefined;
  const file = fd.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (5 Mo maximum)." };
    try {
      avatar = await savePublicImage(Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Photo invalide." };
    }
  } else if (fd.get("removeAvatar") === "1") avatar = null;

  await db
    .update(users)
    .set({
      fullName: v.fullName,
      phone: v.phone || null,
      gender: v.gender || null,
      birthDate: v.birthDate || null,
      address: v.address || null,
      postalCode: v.postalCode || null,
      city: v.city || null,
      country: v.country || null,
      emailNotifications: v.emailNotifications,
      ...(avatar !== undefined ? { avatarUrl: avatar } : {}),
    })
    .where(eq(users.id, u.id));
  if (avatar !== undefined) await deletePublicImage(u.avatarUrl);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil enregistré." };
}

export async function setLocale(locale: string): Promise<Result> {
  const u = await me();
  const parsed = z.enum(["fr", "en", "nl", "de", "es", "it"]).safeParse(locale);
  if (!parsed.success) return { ok: false, error: "Langue inconnue." };
  await db.update(users).set({ locale: parsed.data }).where(eq(users.id, u.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Langue enregistrée." };
}

/* ───────────── Email ───────────── */

export async function requestEmailChange(input: { email: string; password: string }): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  const email = z.email({ message: "Adresse email invalide." }).safeParse(String(input.email ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: email.error.issues[0]!.message };
  if (email.data === u.email.toLowerCase()) return { ok: false, error: "C'est déjà votre adresse." };
  if (!rateLimit(`email-change:${u.id}`, 5, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  if (u.passwordHash && !(await verifyPassword(String(input.password ?? ""), u.passwordHash))) return { ok: false, error: "Mot de passe incorrect." };
  const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email.data}`);
  if (taken) return { ok: false, error: "Cette adresse est déjà utilisée par un autre compte." };
  await issueCode({ id: u.id, name: u.fullName }, email.data, "email_change");
  return { ok: true, message: `Un code a été envoyé à ${email.data}.` };
}

export async function confirmEmailChange(code: string): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  const res = await consumeCode(u.id, "email_change", code);
  if (!res.ok) return res;
  const [taken] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${res.email}`, ne(users.id, u.id)));
  if (taken) return { ok: false, error: "Cette adresse est déjà utilisée par un autre compte." };
  await db.update(users).set({ email: res.email, emailVerifiedAt: new Date() }).where(eq(users.id, u.id));
  await linkInvitations(u.id, res.email);
  await linkCustomerRecords(u.id, res.email);
  await destroyAllSessions(u.id, true);
  revalidatePath("/", "layout");
  return { ok: true, message: "Adresse email modifiée." };
}

/* ───────────── Mot de passe ───────────── */

export async function changePassword(input: { current: string; next: string }): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  if (!rateLimit(`pwd:${u.id}`, 6, 15 * 60 * 1000).ok) return { ok: false, error: "Trop d'essais. Réessayez plus tard." };
  if (u.passwordHash && !(await verifyPassword(String(input.current ?? ""), u.passwordHash))) return { ok: false, error: "Mot de passe actuel incorrect." };
  const next = String(input.next ?? "");
  if (next.length < 10) return { ok: false, error: "Le nouveau mot de passe doit contenir au moins 10 caractères." };
  if (next.length > 200) return { ok: false, error: "Mot de passe trop long." };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, u.id));
  // Les autres appareils sont déconnectés ; celui-ci reste connecté.
  await destroyAllSessions(u.id, true);
  return { ok: true, message: u.passwordHash ? "Mot de passe modifié. Vos autres appareils ont été déconnectés." : "Mot de passe défini." };
}

/* ───────────── Double authentification ───────────── */

export async function startTwoFactor(): Promise<{ ok: true; secret: string; qr: string } | { ok: false; error: string }> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  if (u.twoFactorSecret) return { ok: false, error: "La double authentification est déjà activée." };
  const secret = generateSecret();
  const qr = await QRCode.toDataURL(otpauthUrl(secret, u.email), { width: 220, margin: 1 });
  return { ok: true, secret, qr };
}

export async function enableTwoFactor(input: { secret: string; code: string }): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  if (!/^[A-Z2-7]{32}$/.test(input.secret ?? "")) return { ok: false, error: "Configuration invalide. Recommencez." };
  if (!verifyTotp(input.secret, String(input.code ?? ""))) return { ok: false, error: "Code incorrect. Vérifiez votre application." };
  await db.update(users).set({ twoFactorSecret: encrypt(input.secret) }).where(eq(users.id, u.id));
  return { ok: true, message: "Double authentification activée." };
}

export async function disableTwoFactor(code: string): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  if (!u.twoFactorSecret) return { ok: true };
  if (!rateLimit(`2fa-off:${u.id}`, 6, 15 * 60 * 1000).ok) return { ok: false, error: "Trop d'essais." };
  const secret = decrypt(u.twoFactorSecret);
  if (!secret || !verifyTotp(secret, code)) return { ok: false, error: "Code incorrect." };
  await db.update(users).set({ twoFactorSecret: null }).where(eq(users.id, u.id));
  return { ok: true, message: "Double authentification désactivée." };
}

/* ───────────── Suppression du compte ───────────── */

export async function requestAccountDeletion(password: string): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  if (!rateLimit(`del:${u.id}`, 4, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de demandes." };
  if (u.passwordHash && !(await verifyPassword(String(password ?? ""), u.passwordHash))) return { ok: false, error: "Mot de passe incorrect." };
  await issueCode({ id: u.id, name: u.fullName }, u.email, "account_deletion");
  return { ok: true, message: `Un code de confirmation a été envoyé à ${u.email}.` };
}

/**
 * Suppression définitive : les établissements possédés sont fermés (suppression logique, l'historique
 * des patients reste consultable par le support le temps légal), le compte est effacé.
 */
export async function confirmAccountDeletion(code: string): Promise<Result> {
  if (await isImpersonating()) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
  const u = await me();
  const res = await consumeCode(u.id, "account_deletion", code);
  if (!res.ok) return res;
  await deleteUserAccount(u.id, { id: u.id, name: u.fullName });
  await destroySession();
  redirect("/?compte=supprime");
}
