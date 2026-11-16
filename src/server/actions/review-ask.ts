"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { requireContext } from "@/server/context";

/** Demande d'avis Google sur Skydev : « c'est fait » (ne plus demander) ou « plus tard » (dans 30 jours). */
export async function answerReviewAsk(answer: "done" | "later") {
  const ctx = await requireContext();
  const value = answer === "done" ? { done: true } : { later: new Date(Date.now() + 30 * 86400_000).toISOString() };
  await db.update(members).set({ prefs: sql`${members.prefs} || ${JSON.stringify({ reviewAsk: value })}::jsonb` }).where(eq(members.id, ctx.member.id));
  revalidatePath("/app");
}
