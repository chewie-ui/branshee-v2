"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses, shopSettings } from "@/db/schema";
import { requireContext } from "@/server/context";
import { shopRights } from "@/server/shop";
import { setSitePublished } from "@/server/actions/site";
import type { OnlineKind } from "@/server/online";

type Result = { ok: boolean; message?: string; error?: string };

/** Interrupteur simple : met en ligne ou coupe la réservation en ligne, le site web ou la boutique. */
export async function setOnline(kind: OnlineKind, on: boolean): Promise<Result> {
  if (kind === "site") return setSitePublished(on);
  if (kind === "booking") {
    const ctx = await requireContext("settings.manage", { write: true });
    await db.update(businesses).set({ pausedAt: on ? null : new Date() }).where(eq(businesses.id, ctx.business.id));
    await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: on ? "business.resume" : "business.pause", description: on ? "Réservations en ligne réactivées" : "Réservations en ligne mises en pause" });
    revalidatePath("/", "layout");
    return { ok: true, message: on ? "Réservation en ligne réactivée." : "Réservation en ligne en pause." };
  }
  if (kind === "shop") {
    const ctx = await requireContext(undefined, { app: "boutique" });
    if (ctx.impersonating) return { ok: false, error: "Action réservée au titulaire du compte (session de supervision)." };
    if (!shopRights(ctx).manage) return { ok: false, error: "Seul le responsable règle la boutique." };
    const [s] = await db.select().from(shopSettings).where(eq(shopSettings.businessId, ctx.business.id));
    if (on && (!s || (!s.pickup && !s.delivery) || (!s.payOnline && !s.payOnPickup && !s.payTransfer))) return { ok: false, error: "Réglez d'abord la boutique (retrait ou livraison, moyen de paiement) dans Boutique › Réglages." };
    await db.update(shopSettings).set({ enabled: on, updatedAt: new Date() }).where(eq(shopSettings.businessId, ctx.business.id));
    await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: on ? "shop.open" : "shop.close", description: on ? "Boutique ouverte" : "Boutique fermée" });
    revalidatePath("/", "layout");
    return { ok: true, message: on ? "Boutique ouverte." : "Boutique fermée." };
  }
  return { ok: false, error: "Inconnu." };
}
