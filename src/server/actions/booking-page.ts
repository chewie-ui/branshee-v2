"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, bookingPageSettings, formQuestions } from "@/db/schema";
import { requireContext } from "@/server/context";

type Result = { ok: true } | { ok: false; error: string };

const questionSchema = z.object({
  label: z.string().trim().min(2, "Chaque question doit avoir un intitulé.").max(200),
  type: z.enum(["text", "choice", "yes_no"]),
  isRequired: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(12),
});

/** Remplace l'ensemble des questions posées avant la réservation (ordre = ordre de la liste). */
export async function saveFormQuestions(input: unknown): Promise<Result> {
  const ctx = await requireContext("forms.manage");
  const parsed = z.array(questionSchema).max(10, "10 questions maximum.").safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  for (const q of parsed.data) if (q.type === "choice" && q.options.length < 2) return { ok: false, error: `« ${q.label} » : ajoutez au moins deux choix.` };
  await db.transaction(async (tx) => {
    await tx.delete(formQuestions).where(eq(formQuestions.businessId, ctx.business.id));
    if (parsed.data.length) {
      await tx.insert(formQuestions).values(parsed.data.map((q, i) => ({ businessId: ctx.business.id, label: q.label, type: q.type, isRequired: q.isRequired, options: q.type === "choice" ? q.options : [], position: i })));
    }
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "form.update", description: "Questions de réservation modifiées" });
  });
  revalidatePath("/app/page-de-reservation");
  return { ok: true };
}

const pageSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Couleur invalide."),
  faq: z
    .array(z.object({ question: z.string().trim().min(2, "Chaque question fréquente doit avoir une question et une réponse.").max(200), answer: z.string().trim().min(1, "Chaque question fréquente doit avoir une question et une réponse.").max(1500) }))
    .max(20),
});

export async function saveBookingPage(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const [current] = await db.select({ theme: bookingPageSettings.theme }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  await db
    .update(bookingPageSettings)
    .set({ theme: { ...(current?.theme ?? { accentText: "#ffffff", pageBg: "#f7f7f8", font: "Inter", radius: "md", layout: "classic" }), accentColor: parsed.data.accentColor }, faq: parsed.data.faq })
    .where(eq(bookingPageSettings.businessId, ctx.business.id));
  revalidatePath("/app/page-de-reservation");
  return { ok: true };
}
