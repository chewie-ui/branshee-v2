"use server";

import { randomBytes } from "node:crypto";
import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { accessLinks, activityLogs, businesses, featureFlags, jobTitles, promoCampaigns, promoCodes, users } from "@/db/schema";
import { APP_FEATURES, HIDDEN_FEATURES, PAGE_FEATURES, navKey } from "@/lib/features";
import { professionKey } from "@/lib/professions";
import { deleteUserAccount } from "@/server/account-deletion";
import { requireSuperadmin } from "@/server/admin";
import { RESERVED_SLUGS } from "@/server/business";
import { invalidateFlags } from "@/server/features";

type Result = { ok: boolean; error?: string; message?: string };

/** « 2026-12-31 » → fin de journée à Bruxelles ; « 2026-12-31T18:00 » → cette heure à Bruxelles. */
function brussels(v: string) {
  const [d, t] = v.split("T");
  const [y, m, day] = d!.split("-").map(Number) as [number, number, number];
  const [h, min] = t ? (t.split(":").map(Number) as [number, number]) : [23, 59];
  return new Date(new TZDate(y, m - 1, day, h, min, t ? 0 : 59, "Europe/Brussels").getTime());
}
const fail = (error: string): Result => ({ ok: false, error });

// ─── Comptes et établissements ───────────────────────────────────────────────

/** Suppression d'un compte par l'équipe (confirmation par saisie de l'email). */
export async function adminDeleteUser(userId: string, confirmEmail: string): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(userId);
  if (id === admin.id) return fail("Vous ne pouvez pas supprimer votre propre compte.");
  const [u] = await db.select({ email: users.email, isSuperadmin: users.isSuperadmin }).from(users).where(eq(users.id, id));
  if (!u) return fail("Utilisateur introuvable.");
  if (u.isSuperadmin) return fail("Retirez d'abord le rôle super-admin de ce compte.");
  if (u.email.toLowerCase() !== String(confirmEmail ?? "").trim().toLowerCase()) return fail("L'email saisi ne correspond pas.");
  await deleteUserAccount(id, { id: admin.id, name: "Équipe Branshee" }, "par l'équipe Branshee (suppression du compte)");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Compte supprimé." };
}

/** Suppression (corbeille) d'un établissement : il disparaît des pages publiques et de l'espace pro. */
export async function adminDeleteBusiness(businessId: string, confirmName: string): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(businessId);
  const [b] = await db.select({ name: businesses.name }).from(businesses).where(and(eq(businesses.id, id), isNull(businesses.deletedAt)));
  if (!b) return fail("Établissement introuvable.");
  if (b.name.trim().toLowerCase() !== String(confirmName ?? "").trim().toLowerCase()) return fail("Le nom saisi ne correspond pas.");
  await db.update(businesses).set({ deletedAt: new Date(), pausedAt: new Date() }).where(eq(businesses.id, id));
  await db.insert(activityLogs).values({ businessId: id, userId: admin.id, actorName: "Équipe Branshee", action: "business.deleted", description: "Établissement supprimé par l'équipe Branshee" });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Établissement supprimé." };
}

const infoSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(80),
  businessType: z.string().trim().max(60),
  city: z.string().trim().max(80),
  email: z.union([z.literal(""), z.email("Email invalide.")]),
  phone: z.string().trim().max(30),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Adresse : lettres, chiffres et tirets (3 à 60)."),
});

/** Correction des informations d'un établissement (demande du pro, faute de frappe…). */
export async function adminUpdateBusiness(businessId: string, input: z.input<typeof infoSchema>): Promise<Result> {
  const admin = await requireSuperadmin();
  const id = z.uuid().parse(businessId);
  const parsed = infoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  const d = parsed.data;
  if (RESERVED_SLUGS.has(d.slug)) return fail("Cette adresse est réservée.");
  const [taken] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.slug, d.slug), sql`${businesses.id} <> ${id}`));
  if (taken) return fail("Cette adresse est déjà prise.");
  await db.update(businesses).set({ name: d.name, businessType: d.businessType || null, city: d.city || null, email: d.email || null, phone: d.phone || null, slug: d.slug }).where(eq(businesses.id, id));
  await db.insert(activityLogs).values({ businessId: id, userId: admin.id, actorName: "Équipe Branshee", action: "admin.update", description: "Informations de l'établissement corrigées par l'équipe Branshee" });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Informations enregistrées." };
}

/** Mise en avant sur la page d'accueil et l'annuaire : 0 = non, 1 = en premier, 2 = ensuite… */
export async function setBoost(businessId: string, position: number): Promise<Result> {
  await requireSuperadmin();
  const id = z.uuid().parse(businessId);
  const pos = z.number().int().min(0).max(99).safeParse(position);
  if (!pos.success) return fail("Position invalide (0 à 99).");
  await db.update(businesses).set({ boostPosition: pos.data }).where(eq(businesses.id, id));
  revalidatePath("/admin/mise-en-avant");
  return { ok: true };
}

/** Métier proposé par un pro ou utilisé hors liste : validé (devient reconnu), bloqué, ou remis en attente. */
export async function decideJobTitle(name: string, status: "approved" | "blocked" | "pending"): Promise<Result> {
  await requireSuperadmin();
  const clean = String(name ?? "").trim().slice(0, 80);
  if (!clean || !["approved", "blocked", "pending"].includes(status)) return fail("Requête invalide.");
  const key = professionKey(clean);
  await db
    .insert(jobTitles)
    .values({ name: clean, key, status, source: "usage", decidedAt: new Date() })
    .onConflictDoUpdate({ target: jobTitles.key, set: { status, decidedAt: new Date() } });
  revalidatePath("/admin/metiers");
  return { ok: true };
}

// ─── Interrupteurs ───────────────────────────────────────────────────────────

const KNOWN = new Map<string, string>([...PAGE_FEATURES, ...APP_FEATURES, ...HIDDEN_FEATURES].map((f) => [f.key, f.label]));

export async function setFeatureStatus(key: string, status: "active" | "maintenance" | "error" | "disabled", message: string): Promise<Result> {
  await requireSuperadmin();
  const label = KNOWN.get(key);
  if (!label || !["active", "maintenance", "error", "disabled"].includes(status)) return fail("Interrupteur inconnu.");
  const msg = String(message ?? "").trim().slice(0, 300) || null;
  await db.insert(featureFlags).values({ key, label, status, message: msg }).onConflictDoUpdate({ target: featureFlags.key, set: { status, message: msg } });
  invalidateFlags();
  revalidatePath("/admin/fonctionnalites");
  return { ok: true };
}

/** Masque (ou réaffiche) un lien du menu de l'espace pro pour tout le monde. */
export async function toggleNavLink(href: string, hidden: boolean): Promise<Result> {
  await requireSuperadmin();
  if (!/^\/app(\/[a-z0-9-]+)*$/.test(href) || href === "/app") return fail("Lien invalide.");
  const key = navKey(href);
  await db.insert(featureFlags).values({ key, label: href, status: "active", hiddenInNav: hidden }).onConflictDoUpdate({ target: featureFlags.key, set: { hiddenInNav: hidden } });
  invalidateFlags();
  revalidatePath("/admin/fonctionnalites");
  return { ok: true };
}

// ─── Codes promo, campagne, liens d'accès ────────────────────────────────────

const promoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Code : 3 à 30 lettres, chiffres, - ou _."),
  discountType: z.enum(["percent", "fixed", "trial"]),
  value: z.number().min(0).max(100000),
  trialDays: z.number().int().min(1).max(365),
  maxUses: z.number().int().min(1).max(100000).nullable(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  appliesTo: z.enum(["", "pro", "pro_plus", "pro:month", "pro:year", "pro_plus:month", "pro_plus:year"]),
});

export async function createPromoCode(input: z.input<typeof promoSchema>): Promise<Result> {
  await requireSuperadmin();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  const d = parsed.data;
  if (d.discountType === "percent" && (d.value < 1 || d.value > 100)) return fail("Pourcentage entre 1 et 100.");
  if (d.discountType === "fixed" && d.value <= 0) return fail("Montant de la réduction requis.");
  const [dup] = await db.select({ id: promoCodes.id }).from(promoCodes).where(sql`upper(${promoCodes.code}) = ${d.code}`);
  if (dup) return fail("Ce code existe déjà.");
  await db.insert(promoCodes).values({
    code: d.code,
    discountType: d.discountType,
    discountValue: d.discountType === "fixed" ? Math.round(d.value * 100) : d.discountType === "percent" ? Math.round(d.value) : 0,
    trialDays: d.trialDays,
    maxUses: d.maxUses,
    expiresAt: d.expiresAt ? brussels(d.expiresAt) : null,
    appliesTo: d.appliesTo || null,
  });
  revalidatePath("/admin/promotions");
  return { ok: true, message: `Code ${d.code} créé.` };
}

export async function togglePromoCode(id: string, field: "isActive" | "isDefaultOffer"): Promise<Result> {
  await requireSuperadmin();
  const pid = z.uuid().parse(id);
  const [p] = await db.select().from(promoCodes).where(eq(promoCodes.id, pid));
  if (!p) return fail("Code introuvable.");
  if (field === "isDefaultOffer" && !p.isDefaultOffer) await db.update(promoCodes).set({ isDefaultOffer: false }).where(eq(promoCodes.isDefaultOffer, true));
  await db.update(promoCodes).set(field === "isActive" ? { isActive: !p.isActive } : { isDefaultOffer: !p.isDefaultOffer }).where(eq(promoCodes.id, pid));
  revalidatePath("/admin/promotions");
  return { ok: true };
}

export async function deletePromoCode(id: string): Promise<Result> {
  await requireSuperadmin();
  await db.delete(promoCodes).where(eq(promoCodes.id, z.uuid().parse(id)));
  revalidatePath("/admin/promotions");
  return { ok: true };
}

const campaignSchema = z.object({ isActive: z.boolean(), endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")), firstPeriodEuros: z.number().min(0).max(1000), plan: z.enum(["pro", "pro_plus"]) });

/** Campagne à compte à rebours : première période à prix cassé (une seule campagne). */
export async function saveCampaign(input: z.input<typeof campaignSchema>): Promise<Result> {
  await requireSuperadmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return fail("Campagne invalide.");
  const d = parsed.data;
  const endsAt = d.endsAt ? brussels(d.endsAt) : null;
  if (d.isActive && (!endsAt || endsAt < new Date())) return fail("Choisissez une date de fin dans le futur.");
  const values = { isActive: d.isActive, endsAt, firstPeriodCents: Math.round(d.firstPeriodEuros * 100), plan: d.plan };
  const [cur] = await db.select({ id: promoCampaigns.id }).from(promoCampaigns).limit(1);
  if (cur) await db.update(promoCampaigns).set(values).where(eq(promoCampaigns.id, cur.id));
  else await db.insert(promoCampaigns).values(values);
  revalidatePath("/admin/promotions");
  return { ok: true, message: d.isActive ? "Campagne en ligne." : "Campagne arrêtée." };
}

const linkSchema = z.object({ label: z.string().trim().max(120), plan: z.enum(["pro", "pro_plus"]), durationDays: z.number().int().min(1).max(730), maxUses: z.number().int().min(1).max(10000), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")) });

/** Lien qui offre un forfait pendant N jours à l'établissement de la personne qui l'ouvre. */
export async function createAccessLink(input: z.input<typeof linkSchema>): Promise<Result> {
  await requireSuperadmin();
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  const d = parsed.data;
  const code = randomBytes(9).toString("base64url");
  await db.insert(accessLinks).values({ code, label: d.label || null, plan: d.plan, durationDays: d.durationDays, maxUses: d.maxUses, expiresAt: d.expiresAt ? brussels(d.expiresAt) : null });
  revalidatePath("/admin/liens-acces");
  return { ok: true, message: "Lien créé." };
}

export async function toggleAccessLink(id: string): Promise<Result> {
  await requireSuperadmin();
  await db.update(accessLinks).set({ isActive: sql`not ${accessLinks.isActive}` }).where(eq(accessLinks.id, z.uuid().parse(id)));
  revalidatePath("/admin/liens-acces");
  return { ok: true };
}

export async function deleteAccessLink(id: string): Promise<Result> {
  await requireSuperadmin();
  await db.delete(accessLinks).where(eq(accessLinks.id, z.uuid().parse(id)));
  revalidatePath("/admin/liens-acces");
  return { ok: true };
}
