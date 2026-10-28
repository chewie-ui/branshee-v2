"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { requireContext } from "@/server/context";
import { disconnectCalendar } from "@/server/google";

export async function disconnectGoogleCalendar(): Promise<{ ok: boolean }> {
  const ctx = await requireContext(undefined, { write: true });
  await disconnectCalendar(ctx.user.id);
  revalidatePath("/app/reglages/integrations");
  return { ok: true };
}

/** Nouveau lien de flux d'agenda (l'ancien cesse de fonctionner : utile s'il a été partagé par erreur). */
export async function regenerateCalendarFeed(): Promise<{ ok: boolean; token: string }> {
  const ctx = await requireContext(undefined, { write: true });
  if (ctx.impersonating) return { ok: false, token: "" };
  const token = randomBytes(24).toString("hex");
  await db.update(members).set({ calendarFeedToken: token }).where(eq(members.id, ctx.member.id));
  revalidatePath("/app/reglages/integrations");
  return { ok: true, token };
}
