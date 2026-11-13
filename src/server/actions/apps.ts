"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { businesses, members } from "@/db/schema";
import { ALWAYS_SHOWN, APPS, NEEDS, TEAM_SIZES, hiddenAppsFor, type AppId, type NeedId, type TeamSize } from "@/lib/apps";
import { recommendedApps } from "@/lib/app-store";
import { requireContext } from "@/server/context";

type Result = { ok: true; message?: string; added?: string[] } | { ok: false; error: string };

const setupSchema = z.object({
  teamSize: z.enum(TEAM_SIZES.map((t) => t.value) as [TeamSize, ...TeamSize[]]),
  needs: z.array(z.enum(NEEDS.map((n) => n.id) as [NeedId, ...NeedId[]])).max(NEEDS.length),
});

/** Questionnaire de départ : range hors de l'accueil les apps dont l'entreprise n'a pas besoin. */
export async function saveAppSetup(input: { teamSize: string; needs: string[] }): Promise<Result> {
  const ctx = await requireContext(undefined, { allowLocked: true });
  if (!ctx.member.isOwner && !ctx.can("settings.manage")) return { ok: false, error: "Seul le responsable peut choisir les apps de l'entreprise." };
  const v = setupSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Réponses invalides." };
  // Les apps du métier (« Plombier » → Interventions, Factures…) sont installées d'office ; le reste se prend dans l'App store.
  const rec = new Set<AppId>(recommendedApps(ctx.business.businessType));
  const hiddenApps = v.data.needs.length
    ? hiddenAppsFor(v.data.teamSize, v.data.needs).filter((id) => !rec.has(id))
    : APPS.map((a) => a.id).filter((id) => !rec.has(id) && !ALWAYS_SHOWN.includes(id) && !(id === "employes" && v.data.teamSize !== "solo"));
  const patch = { appsSetupAt: new Date().toISOString(), teamSize: v.data.teamSize, needs: v.data.needs, hiddenApps };
  await db.update(businesses).set({ onboarding: sql`${businesses.onboarding} || ${JSON.stringify(patch)}::jsonb` }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Ajouter une app à l'entreprise (App store), ou la retirer : elle reste disponible dans l'App store. */
export async function setAppPinned(appId: string, pinned: boolean): Promise<Result> {
  const ctx = await requireContext(undefined, { allowLocked: true });
  if (!ctx.member.isOwner && !ctx.can("settings.manage")) return { ok: false, error: "Seul le responsable peut changer les apps de l'accueil." };
  if (!APPS.some((a) => a.id === appId) || appId === "reglages") return { ok: false, error: "App inconnue." };
  const [b] = await db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, ctx.business.id));
  const hidden = new Set(b?.o.hiddenApps ?? []);
  // Apps indispensables à une autre (Boutique vend les produits du Stock) : ajoutées avec elle, et pas retirables tant qu'elle est là.
  const needs = APP_NEEDS[appId as keyof typeof APP_NEEDS] ?? [];
  const neededBy = Object.entries(APP_NEEDS).filter(([k, v]) => (v as readonly string[]).includes(appId) && !hidden.has(k)).map(([k]) => APPS.find((a) => a.id === k)?.name ?? k);
  if (!pinned && neededBy.length) return { ok: false, error: `${APPS.find((a) => a.id === appId)?.name ?? appId} est indispensable à ${neededBy.join(", ")} : retirez d'abord ${neededBy.length > 1 ? "ces apps" : "cette app"}.` };
  const added = pinned ? needs.filter((n) => hidden.has(n)) : [];
  if (pinned) { hidden.delete(appId); for (const n of needs) hidden.delete(n); }
  else hidden.add(appId);
  await db.update(businesses).set({ onboarding: sql`${businesses.onboarding} || ${JSON.stringify({ hiddenApps: [...hidden] })}::jsonb` }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app", "layout");
  return { ok: true, message: pinned ? "App ajoutée." : "App retirée.", added: added.map((n) => APPS.find((a) => a.id === n)?.name ?? n) };
}

/** Une app qui a besoin d'une autre pour fonctionner. */
const APP_NEEDS = { boutique: ["stock"] } as const;

/** Épingler une app en favori (préférence personnelle) : elle passe en tête de l'accueil et dans les raccourcis. */
export async function setFavoriteApp(appId: string, fav: boolean): Promise<Result> {
  const ctx = await requireContext(undefined, { allowLocked: true });
  if (!APPS.some((a) => a.id === appId) || !ctx.canApp(appId)) return { ok: false, error: "App inconnue." };
  const [m] = await db.select({ p: members.prefs }).from(members).where(eq(members.id, ctx.member.id));
  const list = (m?.p.favApps ?? []).filter((x) => x !== appId && APPS.some((a) => a.id === x));
  if (fav) list.push(appId);
  await db.update(members).set({ prefs: sql`${members.prefs} || ${JSON.stringify({ favApps: list.slice(0, 12) })}::jsonb` }).where(eq(members.id, ctx.member.id));
  revalidatePath("/app", "layout");
  return { ok: true, message: fav ? "App épinglée." : "App désépinglée." };
}
