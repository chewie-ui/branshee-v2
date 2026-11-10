"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses } from "@/db/schema";
import { APPS } from "@/lib/apps";
import { appAvailableIn } from "@/lib/apps-i18n";
import { countryName, isCountryCode } from "@/lib/countries";
import { tr } from "@/lib/i18n/app";
import { requireContext } from "@/server/context";

type Result = { ok: true; message: string } | { ok: false; error: string };

/** Réglages › Entreprise : pays de l'entreprise (décide des apps proposées : règles belges, zone euro). */
export async function saveBusinessCountry(code: string): Promise<Result> {
  const ctx = await requireContext("business.manage", { write: true });
  const locale = ctx.user.locale ?? "fr";
  if (!isCountryCode(code)) return { ok: false, error: tr("Choix invalide.", locale) };
  await db.update(businesses).set({ countryCode: code }).where(eq(businesses.id, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "business.country", description: `Pays de l'entreprise : ${countryName(code)}` });
  revalidatePath("/app", "layout");
  const off = APPS.filter((a) => a.status === "active" && !appAvailableIn(a.id, code)).length;
  return { ok: true, message: off ? tr("Enregistré. {n} app(s) réservée(s) à d'autres pays ne sont plus proposées.", locale, { n: off }) : tr("Enregistré. Toutes les apps sont disponibles dans ce pays.", locale) };
}
