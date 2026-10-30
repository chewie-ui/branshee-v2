"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, dealActivities, deals, prospectCalls, prospectScripts, prospects } from "@/db/schema";
import { OUTCOMES, isOutcome, phoneKey } from "@/lib/prospects";
import { requireContext, type AppContext } from "@/server/context";
import { salesRights } from "@/server/sales";

type Result = { ok: true; message?: string; id?: string; dealId?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const NF = { ok: false as const, error: "Prospect introuvable." };
const refresh = () => revalidatePath("/app/ventes", "layout");

async function editor(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext(undefined, { app: "ventes", write: true });
  if (ctx.impersonating) return { ctx, error: SUPERVISION };
  if (!salesRights(ctx).manage) return { ctx, error: { ok: false, error: "Vous n'avez pas le droit de modifier la prospection." } };
  return { ctx, error: null };
}

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const schema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Indiquez un nom (personne ou entreprise).").max(120),
  company: opt(120),
  phone: opt(40),
  email: z.union([z.literal(""), z.email({ message: "Email invalide." })]).transform((v) => v.toLowerCase() || null),
  city: opt(80),
  trade: opt(80),
  note: opt(2000),
});

/** Ajouter ou modifier un prospect (un même numéro n'est pas ajouté deux fois). */
export async function saveProspect(input: z.input<typeof schema>): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (!d.phone && !d.email) return { ok: false, error: "Indiquez au moins un téléphone ou un email pour pouvoir le contacter." };
  const key = phoneKey(d.phone);
  if (key) {
    const [dup] = await db
      .select({ id: prospects.id, name: prospects.name })
      .from(prospects)
      .where(and(eq(prospects.businessId, ctx.business.id), sql`regexp_replace(regexp_replace(coalesce(${prospects.phone}, ''), '\\D', '', 'g'), '^(0032|32)', '0') = ${key}`));
    if (dup && dup.id !== d.id) return { ok: false, error: `Ce numéro est déjà dans votre liste (${dup.name}).` };
  }
  const values = { name: d.name, company: d.company, phone: d.phone, email: d.email, city: d.city, trade: d.trade, note: d.note, updatedAt: new Date() };
  if (d.id) {
    const done = await db.update(prospects).set(values).where(and(eq(prospects.id, d.id), eq(prospects.businessId, ctx.business.id))).returning({ id: prospects.id });
    if (!done.length) return NF;
    refresh();
    return { ok: true, id: d.id, message: "Prospect modifié." };
  }
  const [row] = await db.insert(prospects).values({ ...values, businessId: ctx.business.id, ownerMemberId: ctx.member.id }).returning({ id: prospects.id });
  refresh();
  return { ok: true, id: row!.id, message: "Prospect ajouté." };
}

export async function deleteProspect(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return NF;
  const done = await db.delete(prospects).where(and(eq(prospects.id, id), eq(prospects.businessId, ctx.business.id))).returning({ id: prospects.id });
  if (!done.length) return NF;
  refresh();
  return { ok: true, message: "Prospect supprimé." };
}

/** Remettre un prospect dans la file (ex. un refus d'il y a six mois). */
export async function reopenProspect(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return NF;
  const done = await db.update(prospects).set({ status: "todo", attempts: 0, callbackAt: null, refuseReason: null, updatedAt: new Date() }).where(and(eq(prospects.id, id), eq(prospects.businessId, ctx.business.id))).returning({ id: prospects.id });
  if (!done.length) return NF;
  refresh();
  return { ok: true, message: "Remis dans la liste à appeler." };
}

const callSchema = z.object({
  id: z.uuid(),
  outcome: z.string().refine(isOutcome, "Résultat inconnu."),
  note: z.string().trim().max(2000).default(""),
  callbackAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).default(""),
  reason: z.string().trim().max(120).default(""),
});

/**
 * Noter le résultat d'un appel. « Intéressé » crée une piste dans Ventes (étape « Contacté »),
 * avec la note de l'appel dans son historique.
 */
export async function logCall(input: z.input<typeof callSchema>): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = callSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  const outcome = d.outcome as keyof typeof OUTCOMES;
  const callbackAt = d.callbackAt ? new Date(d.callbackAt) : null;
  if (outcome === "callback" && (!callbackAt || callbackAt.getTime() < Date.now() - 60_000)) return { ok: false, error: "Choisissez quand rappeler (date et heure à venir)." };
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(prospects).where(and(eq(prospects.id, d.id), eq(prospects.businessId, ctx.business.id))).for("update");
    if (!p) return NF;
    let dealId = p.dealId;
    if (outcome === "interested" && !dealId) {
      const [deal] = await tx
        .insert(deals)
        .values({ businessId: ctx.business.id, title: p.company ? `${p.company}${p.name !== p.company ? ` (${p.name})` : ""}` : p.name, contactName: p.name, companyName: p.company, email: p.email, phone: p.phone, stage: "contacted", source: "Prospection", ownerMemberId: ctx.member.id })
        .returning({ id: deals.id });
      dealId = deal!.id;
      await tx.insert(dealActivities).values({ businessId: ctx.business.id, dealId, memberId: ctx.member.id, kind: "call", body: `Prospection : intéressé${d.note ? `. ${d.note}` : "."}` });
    }
    await tx
      .update(prospects)
      .set({
        status: OUTCOMES[outcome].status,
        attempts: outcome === "no_answer" ? p.attempts + 1 : p.attempts,
        lastCallAt: new Date(),
        callbackAt: outcome === "callback" ? callbackAt : null,
        refuseReason: outcome === "refused" ? d.reason || null : null,
        dealId,
        note: d.note ? [p.note, d.note].filter(Boolean).join("\n").slice(-2000) : p.note,
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, p.id));
    await tx.insert(prospectCalls).values({ businessId: ctx.business.id, prospectId: p.id, memberId: ctx.member.id, outcome, note: [d.reason, d.note].filter(Boolean).join(" · ") || null });
    if (outcome === "interested") await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "prospect.interested", description: `Prospection : ${p.name} est intéressé (piste créée)` });
    refresh();
    return { ok: true as const, dealId: dealId ?? undefined, message: outcome === "interested" ? "Bravo ! Piste créée dans Ventes." : `${OUTCOMES[outcome].label} : noté.` };
  });
}

export async function saveScript(body: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = z.string().max(8000).safeParse(body);
  if (!v.success) return { ok: false, error: "Script trop long (8 000 caractères maximum)." };
  await db.insert(prospectScripts).values({ businessId: ctx.business.id, body: v.data }).onConflictDoUpdate({ target: prospectScripts.businessId, set: { body: v.data, updatedAt: new Date() } });
  return { ok: true, message: "Script enregistré." };
}
