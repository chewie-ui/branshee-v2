import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { intakeOptions, intakeQuestions, serviceIntakeRules } from "@/db/schema";
import type { IntakeQuestion } from "@/lib/intake";

/** Questions d'orientation d'un établissement, dans l'ordre où elles sont posées, avec les prestations liées à chaque réponse. */
export async function listIntake(businessId: string): Promise<IntakeQuestion[]> {
  const questions = await db.select({ id: intakeQuestions.id, question: intakeQuestions.question }).from(intakeQuestions).where(eq(intakeQuestions.businessId, businessId)).orderBy(asc(intakeQuestions.position), asc(intakeQuestions.createdAt));
  if (questions.length === 0) return [];
  const options = await db
    .select({ id: intakeOptions.id, questionId: intakeOptions.questionId, label: intakeOptions.label })
    .from(intakeOptions)
    .where(inArray(intakeOptions.questionId, questions.map((q) => q.id)))
    .orderBy(asc(intakeOptions.position));
  const rules = options.length ? await db.select().from(serviceIntakeRules).where(inArray(serviceIntakeRules.optionId, options.map((o) => o.id))) : [];
  return questions.map((q) => ({
    ...q,
    options: options.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, label: o.label, serviceIds: rules.filter((r) => r.optionId === o.id).map((r) => r.serviceId) })),
  }));
}
