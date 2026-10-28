"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assistantSettings } from "@/db/schema";
import { cleanHistory } from "@/lib/assistant";
import { requireContext } from "@/server/context";
import { assistantAllowed, assistantEnabled, runAssistant, takeQuota } from "@/server/assistant";

type Answer = { ok: true; text: string; links: string[] } | { ok: false; error: string };

/** Pose une question à l'assistant (historique gardé dans le navigateur, textes seulement). */
export async function askAssistant(history: unknown): Promise<Answer> {
  const ctx = await requireContext();
  if (!assistantAllowed(ctx)) return { ok: false, error: "L'assistant n'est pas disponible pour cette entreprise." };
  if (!(await assistantEnabled(ctx.business.id))) return { ok: false, error: "L'assistant n'est pas encore activé : le responsable peut l'activer dans Réglages." };
  const turns = cleanHistory(history);
  if (!turns) return { ok: false, error: "Écrivez votre question." };
  if (!(await takeQuota(ctx))) return { ok: false, error: "Vous avez posé beaucoup de questions aujourd'hui : l'assistant revient demain." };
  try {
    const r = await runAssistant(ctx, turns);
    return { ok: true, ...r };
  } catch {
    return { ok: false, error: "L'assistant ne répond pas pour le moment. Réessayez dans un instant." };
  }
}

/** Le responsable active ou coupe l'assistant pour toute l'entreprise. */
export async function setAssistantEnabled(on: boolean): Promise<{ ok: boolean; error?: string; message?: string }> {
  const ctx = await requireContext();
  if (!(ctx.member.isOwner || ctx.can("settings.manage"))) return { ok: false, error: "Réservé au responsable." };
  if (ctx.impersonating) return { ok: false, error: "Lecture seule pendant la supervision." };
  if (!assistantAllowed(ctx)) return { ok: false, error: "L'assistant n'est pas disponible pour cette entreprise." };
  const v = { enabledAt: on ? new Date() : null, enabledById: on ? ctx.user.id : null };
  await db.insert(assistantSettings).values({ businessId: ctx.business.id, ...v }).onConflictDoUpdate({ target: assistantSettings.businessId, set: v });
  revalidatePath("/app", "layout");
  return { ok: true, message: on ? "Assistant activé pour toute l'équipe." : "Assistant coupé." };
}
