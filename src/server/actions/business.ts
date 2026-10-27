"use server";

import { SKYDEV_PLAN } from "@/lib/skydev-plans";
import { cookies } from "next/headers";
import { after } from "next/server";
import { notifyWelcomePro } from "@/server/notifications";
import { currentBrand } from "@/server/brand";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businesses, jobTitles, members, users } from "@/db/schema";
import { isOfficialProfession, professionKey } from "@/lib/professions";
import { BUSINESS_COOKIE } from "@/server/auth/session";
import { createBusiness } from "@/server/business";
import { requireContext, requireUser } from "@/server/context";

export type CreateBusinessState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de votre établissement.").max(80),
  businessType: z.string().trim().max(60),
  city: z.string().trim().max(80),
});

export async function createBusinessAction(_prev: CreateBusinessState, formData: FormData): Promise<CreateBusinessState> {
  const user = await requireUser();
  const values = { name: String(formData.get("name") ?? ""), businessType: String(formData.get("businessType") ?? ""), city: String(formData.get("city") ?? "") };
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values };
  }
  const [owner] = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.id, user.id));
  // La marque de l'adresse où l'établissement est créé devient la sienne, pour toujours (prix, droits).
  const brand = (await currentBrand()).id;
  // Essai gratuit de 30 jours : seulement pour le premier établissement du compte (même supprimé depuis).
  const firstBusiness = (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, user.id)).limit(1)).length === 0;
  const { business } = await createBusiness(owner!, { name: parsed.data.name, businessType: parsed.data.businessType || null, city: parsed.data.city || null }, { trial: firstBusiness, trialPlan: brand === "skydev" ? SKYDEV_PLAN : "pro", brand });
  if (firstBusiness) after(() => notifyWelcomePro(user.id, business.name));
  // Métier hors liste : proposé à l'équipe (page Métiers du super-admin).
  const type = parsed.data.businessType;
  if (type && !isOfficialProfession(type)) {
    await db.insert(jobTitles).values({ name: type, key: professionKey(type), source: "request", requestedById: user.id }).onConflictDoNothing();
  }
  (await cookies()).set(BUSINESS_COOKIE, business.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  // Sur Skydev, l'accueil est le lanceur d'apps : la carte de bienvenue (étapes RDV) s'affiche dans l'app RDV.
  redirect(brand === "skydev" ? "/app/demarrer" : "/app?bienvenue=1");
}

/** Change l'établissement actif (uniquement parmi ceux dont l'utilisateur est membre actif). */
export async function switchBusiness(businessId: string) {
  const user = await requireUser();
  const id = z.uuid().parse(businessId);
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.userId, user.id), eq(members.businessId, id), eq(members.status, "active"), eq(members.isActive, true)));
  if (!m) return;
  (await cookies()).set(BUSINESS_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  redirect("/app");
}

/** Checklist « Bien démarrer » : le lien a été copié / partagé. */
export async function markLinkShared() {
  const ctx = await requireContext();
  await db.update(businesses).set({ onboarding: sql`${businesses.onboarding} || ${JSON.stringify({ linkSharedAt: new Date().toISOString() })}::jsonb` }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app");
}

/** Masque la checklist « Bien démarrer ». */
export async function dismissOnboarding() {
  const ctx = await requireContext();
  await db.update(businesses).set({ onboarding: sql`${businesses.onboarding} || ${JSON.stringify({ dismissedAt: new Date().toISOString() })}::jsonb` }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app");
}
