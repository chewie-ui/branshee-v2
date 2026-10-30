"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, max, notInArray } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, intakeOptions, intakeQuestions, serviceIntakeRules, services } from "@/db/schema";
import { requireContext } from "@/server/context";

export type IntakeResult = { ok: true; id: string } | { ok: false; error: string };

const schema = z.object({
  question: z.string().trim().min(3, "Écrivez la question.").max(160),
  options: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        label: z.string().trim().min(1, "Chaque réponse doit avoir un texte.").max(80),
        serviceIds: z.array(z.uuid()).max(200),
      }),
    )
    .min(2, "Prévoyez au moins deux réponses.")
    .max(12, "12 réponses maximum.")
    .refine((opts) => new Set(opts.map((o) => o.label.toLowerCase())).size === opts.length, "Deux réponses ont le même texte."),
});

/**
 * Crée ou modifie une question d'orientation avec ses réponses et, pour chaque réponse,
 * les prestations qu'elle affiche. Les identifiants des réponses existantes sont conservés.
 */
export async function saveIntakeQuestion(questionId: string | null, input: z.input<typeof schema>): Promise<IntakeResult> {
  const ctx = await requireContext("services.manage", { app: "rdv" });
  const bid = ctx.business.id;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;

  // Seules les prestations de l'établissement peuvent être liées.
  const wanted = [...new Set(v.options.flatMap((o) => o.serviceIds))];
  const valid = new Set(wanted.length ? (await db.select({ id: services.id }).from(services).where(and(eq(services.businessId, bid), inArray(services.id, wanted)))).map((s) => s.id) : []);

  const id = await db.transaction(async (tx) => {
    let qid = questionId;
    if (qid) {
      const [q] = await tx.update(intakeQuestions).set({ question: v.question }).where(and(eq(intakeQuestions.id, qid), eq(intakeQuestions.businessId, bid))).returning({ id: intakeQuestions.id });
      if (!q) return null;
    } else {
      const [{ pos } = { pos: 0 }] = await tx.select({ pos: max(intakeQuestions.position) }).from(intakeQuestions).where(eq(intakeQuestions.businessId, bid));
      const [q] = await tx.insert(intakeQuestions).values({ businessId: bid, question: v.question, position: (pos ?? -1) + 1 }).returning({ id: intakeQuestions.id });
      qid = q!.id;
    }

    const existing = (await tx.select({ id: intakeOptions.id }).from(intakeOptions).where(eq(intakeOptions.questionId, qid))).map((o) => o.id);
    const kept = v.options.map((o) => o.id).filter((x): x is string => !!x && existing.includes(x));
    // Réponses retirées : supprimées (leurs liens partent avec, par cascade).
    await tx.delete(intakeOptions).where(kept.length ? and(eq(intakeOptions.questionId, qid), notInArray(intakeOptions.id, kept)) : eq(intakeOptions.questionId, qid));

    for (const [position, o] of v.options.entries()) {
      let oid = o.id && kept.includes(o.id) ? o.id : null;
      if (oid) await tx.update(intakeOptions).set({ label: o.label, position }).where(eq(intakeOptions.id, oid));
      else oid = (await tx.insert(intakeOptions).values({ questionId: qid, label: o.label, position }).returning({ id: intakeOptions.id }))[0]!.id;
      await tx.delete(serviceIntakeRules).where(eq(serviceIntakeRules.optionId, oid));
      const links = [...new Set(o.serviceIds)].filter((s) => valid.has(s));
      if (links.length) await tx.insert(serviceIntakeRules).values(links.map((serviceId) => ({ serviceId, optionId: oid! })));
    }

    await tx.insert(activityLogs).values({ businessId: bid, userId: ctx.user.id, actorName: ctx.user.name, action: questionId ? "intake.update" : "intake.create", description: `Question d'orientation ${questionId ? "modifiée" : "ajoutée"} : ${v.question}` });
    return qid;
  });

  if (!id) return { ok: false, error: "Question introuvable." };
  revalidatePath("/app/prestations", "layout");
  return { ok: true, id };
}

export async function deleteIntakeQuestion(questionId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("services.manage", { app: "rdv" });
  const deleted = await db.delete(intakeQuestions).where(and(eq(intakeQuestions.id, z.uuid().parse(questionId)), eq(intakeQuestions.businessId, ctx.business.id))).returning({ q: intakeQuestions.question });
  if (deleted.length) await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "intake.delete", description: `Question d'orientation supprimée : ${deleted[0]!.q}` });
  revalidatePath("/app/prestations", "layout");
  return { ok: deleted.length > 0 };
}

/** Monte ou descend une question dans l'ordre où elles sont posées. */
export async function moveIntakeQuestion(questionId: string, direction: "up" | "down"): Promise<{ ok: boolean }> {
  const ctx = await requireContext("services.manage", { app: "rdv" });
  const list = await db.select({ id: intakeQuestions.id }).from(intakeQuestions).where(eq(intakeQuestions.businessId, ctx.business.id)).orderBy(intakeQuestions.position, intakeQuestions.createdAt);
  const i = list.findIndex((q) => q.id === questionId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false };
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.transaction(async (tx) => {
    for (const [position, q] of list.entries()) await tx.update(intakeQuestions).set({ position }).where(eq(intakeQuestions.id, q.id));
  });
  revalidatePath("/app/prestations", "layout");
  return { ok: true };
}
