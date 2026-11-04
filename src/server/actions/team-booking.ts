"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, bookingSettings, members } from "@/db/schema";
import { requireContext } from "@/server/context";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const schema = z.object({
  teamChoice: z.enum(["choose", "auto"]),
  bookable: z.array(z.string().uuid()).max(500),
});

/** Réservation avec l'équipe : qui prend des rendez-vous, et si le client choisit la personne. */
export async function saveTeamBooking(input: { teamChoice: string; bookable: string[] }): Promise<Result> {
  const ctx = await requireContext("settings.manage", { write: true });
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: "Réglage invalide." };
  const team = await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"), eq(members.isActive, true)));
  // Uniquement les membres de cette entreprise.
  const ids = v.data.bookable.filter((id) => team.some((m) => m.id === id));
  if (!ids.length && team.length) return { ok: false, error: "Gardez au moins une personne qui prend des rendez-vous." };
  await db.transaction(async (tx) => {
    await tx.update(bookingSettings).set({ teamChoice: v.data.teamChoice, updatedAt: new Date() }).where(eq(bookingSettings.businessId, ctx.business.id));
    const all = team.map((m) => m.id);
    if (ids.length) await tx.update(members).set({ isBookable: true }).where(and(eq(members.businessId, ctx.business.id), inArray(members.id, ids)));
    const off = all.filter((id) => !ids.includes(id));
    if (off.length) await tx.update(members).set({ isBookable: false }).where(and(eq(members.businessId, ctx.business.id), inArray(members.id, off)));
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "settings.booking", description: `Équipe : ${ids.length} personne${ids.length > 1 ? "s" : ""} prennent des rendez-vous, ${v.data.teamChoice === "auto" ? "premier disponible" : "le client choisit"}` });
  });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Enregistré." };
}
