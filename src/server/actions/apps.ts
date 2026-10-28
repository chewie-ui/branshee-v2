"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { APPS, NEEDS, TEAM_SIZES, hiddenAppsFor, type NeedId, type TeamSize } from "@/lib/apps";
import { requireContext } from "@/server/context";

type Result = { ok: true; message?: string } | { ok: false; error: string };

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
  const hiddenApps = hiddenAppsFor(v.data.teamSize, v.data.needs);
  const patch = { appsSetupAt: new Date().toISOString(), teamSize: v.data.teamSize, needs: v.data.needs, hiddenApps };
  await db.update(businesses).set({ onboarding: sql`${businesses.onboarding} || ${JSON.stringify(patch)}::jsonb` }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Mettre une app sur l'accueil, ou l'en retirer (elle reste accessible dans « Toutes les apps »). */
export async function setAppPinned(appId: string, pinned: boolean): Promise<Result> {
  const ctx = await requireContext(undefined, { allowLocked: true });
  if (!ctx.member.isOwner && !ctx.can("settings.manage")) return { ok: false, error: "Seul le responsable peut changer les apps de l'accueil." };
  if (!APPS.some((a) => a.id === appId) || appId === "reglages") return { ok: false, error: "App inconnue." };
  const [b] = await db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, ctx.business.id));
  const hidden = new Set(b?.o.hiddenApps ?? []);
  if (pinned) hidden.delete(appId);
  else hidden.add(appId);
  await db.update(businesses).set({ onboarding: sql`${businesses.onboarding} || ${JSON.stringify({ hiddenApps: [...hidden] })}::jsonb` }).where(eq(businesses.id, ctx.business.id));
  revalidatePath("/app", "layout");
  return { ok: true, message: pinned ? "App ajoutée à l'accueil." : "App retirée de l'accueil." };
}
