"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { customers, dealActivities, deals, members } from "@/db/schema";
import { ACTIVITY_KINDS, isStage, stageLabel } from "@/lib/sales";
import { requireContext, type AppContext } from "@/server/context";
import { dealDetailFor, salesRights } from "@/server/sales";
import { newLine, todayIso } from "@/lib/invoicing";
import { getSellerSettings } from "@/server/invoicing";
import { saveDocument } from "@/server/actions/invoicing";

type Result = { ok: true; message?: string; id?: string; url?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const NOPE = { ok: false as const, error: "Vous n'avez pas le droit de modifier les ventes." };
const refresh = () => revalidatePath("/app/ventes", "layout");

async function editor(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext(undefined, { app: "ventes" });
  if (ctx.impersonating) return { ctx, error: SUPERVISION };
  if (!salesRights(ctx).manage) return { ctx, error: NOPE };
  return { ctx, error: null };
}
const day = z.union([z.literal(""), z.iso.date()]).transform((v) => v || null);
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const dealSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Donnez un nom à la piste (ex. : Site web pour Dupont).").max(120),
  contactName: opt(120),
  companyName: opt(120),
  email: z.union([z.literal(""), z.email({ message: "Email invalide." })]).transform((v) => v.toLowerCase() || null),
  phone: opt(40),
  value: z.union([z.number(), z.string()]).transform((v) => Math.round(Number(String(v).replace(",", ".").replace(/\s/g, "") || 0) * 100)).pipe(z.number().int().min(0, "Montant invalide.").max(100_000_000, "Montant invalide.")),
  source: opt(60),
  ownerMemberId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  expectedClose: day,
  nextActionDate: day,
  nextAction: opt(200),
  stage: z.string().optional(),
});

async function ownMember(businessId: string, id: string | null) {
  if (!id) return true;
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, id), eq(members.businessId, businessId)));
  return !!m;
}

/** Créer ou modifier une piste. */
export async function saveDeal(input: z.input<typeof dealSchema>): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = dealSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (!(await ownMember(ctx.business.id, d.ownerMemberId))) return { ok: false, error: "Responsable introuvable." };
  const values = { title: d.title, contactName: d.contactName, companyName: d.companyName, email: d.email, phone: d.phone, valueCents: d.value, source: d.source, ownerMemberId: d.ownerMemberId, expectedClose: d.expectedClose, nextActionDate: d.nextActionDate, nextAction: d.nextAction, updatedAt: new Date() };
  if (d.id) {
    const done = await db.update(deals).set(values).where(and(eq(deals.id, d.id), eq(deals.businessId, ctx.business.id))).returning({ id: deals.id });
    if (!done.length) return { ok: false, error: "Piste introuvable." };
    refresh();
    return { ok: true, message: "Piste enregistrée.", id: d.id };
  }
  const stage = isStage(d.stage) && d.stage !== "won" && d.stage !== "lost" ? d.stage : "lead";
  const [row] = await db.insert(deals).values({ ...values, businessId: ctx.business.id, stage, ownerMemberId: d.ownerMemberId ?? ctx.member.id }).returning({ id: deals.id });
  await db.insert(dealActivities).values({ businessId: ctx.business.id, dealId: row!.id, memberId: ctx.member.id, kind: "stage", body: `Piste créée (${stageLabel(stage)})` });
  refresh();
  return { ok: true, message: "Piste ajoutée.", id: row!.id };
}

/** Changer d'étape (glisser-déposer ou bouton). Gagné / perdu clôturent la piste. */
export async function moveDeal(id: string, stage: string, lostReason?: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success || !isStage(stage)) return { ok: false, error: "Piste introuvable." };
  const reason = stage === "lost" ? (lostReason ?? "").trim().slice(0, 200) || null : null;
  const closed = stage === "won" || stage === "lost";
  return db.transaction(async (tx) => {
    const [old] = await tx.select({ stage: deals.stage }).from(deals).where(and(eq(deals.id, id), eq(deals.businessId, ctx.business.id))).for("update");
    if (!old) return { ok: false as const, error: "Piste introuvable." };
    if (old.stage === stage) return { ok: true as const };
    await tx.update(deals).set({ stage, lostReason: reason, closedAt: closed ? new Date() : null, ...(closed ? { nextActionDate: null, nextAction: null } : {}), updatedAt: new Date() }).where(eq(deals.id, id));
    await tx.insert(dealActivities).values({ businessId: ctx.business.id, dealId: id, memberId: ctx.member.id, kind: "stage", body: `${stageLabel(old.stage)} → ${stageLabel(stage)}${reason ? ` : ${reason}` : ""}` });
    refresh();
    return { ok: true as const, message: stage === "won" ? "Bravo, piste gagnée !" : stage === "lost" ? "Piste classée perdue." : `Piste passée en « ${stageLabel(stage)} ».` };
  });
}

const activitySchema = z.object({
  dealId: z.uuid(),
  kind: z.enum(Object.keys(ACTIVITY_KINDS).filter((k) => k !== "stage") as [string, ...string[]]),
  body: z.string().trim().min(1, "Écrivez quelques mots.").max(2000),
  nextActionDate: day.optional(),
  nextAction: opt(200).optional(),
});

/** Noter un échange (appel, email, rendez-vous, note) et, au passage, la prochaine relance. */
export async function addActivity(input: z.input<typeof activitySchema>): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = activitySchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const [d] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.id, v.data.dealId), eq(deals.businessId, ctx.business.id)));
  if (!d) return { ok: false, error: "Piste introuvable." };
  await db.insert(dealActivities).values({ businessId: ctx.business.id, dealId: d.id, memberId: ctx.member.id, kind: v.data.kind, body: v.data.body });
  const follow = v.data.nextActionDate !== undefined ? { nextActionDate: v.data.nextActionDate, nextAction: v.data.nextAction ?? null } : {};
  await db.update(deals).set({ ...follow, updatedAt: new Date() }).where(eq(deals.id, d.id));
  refresh();
  return { ok: true, message: "Ajouté à l'historique." };
}

export async function deleteDeal(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Piste introuvable." };
  const gone = await db.delete(deals).where(and(eq(deals.id, id), eq(deals.businessId, ctx.business.id))).returning({ id: deals.id });
  if (!gone.length) return { ok: false, error: "Piste introuvable." };
  refresh();
  return { ok: true, message: "Piste supprimée." };
}

/** Relier la piste à une fiche client (retrouvée par email, sinon créée). */
async function ensureCustomer(ctx: AppContext, dealId: string): Promise<{ ok: true; customerId: string; created: boolean } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.businessId, ctx.business.id))).for("update");
    if (!d) return { ok: false as const, error: "Piste introuvable." };
    if (d.customerId) {
      const [c] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.id, d.customerId), eq(customers.businessId, ctx.business.id)));
      if (c) return { ok: true as const, customerId: c.id, created: false };
    }
    let customerId: string | null = null;
    let created = false;
    if (d.email) {
      const [c] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, ctx.business.id), sql`lower(${customers.email}) = ${d.email.toLowerCase()}`));
      customerId = c?.id ?? null;
    }
    if (!customerId) {
      const fullName = d.contactName || d.companyName || d.title;
      const [c] = await tx.insert(customers).values({ businessId: ctx.business.id, fullName, email: d.email, phone: d.phone, companyName: d.companyName, createdManually: true }).returning({ id: customers.id });
      customerId = c!.id;
      created = true;
    }
    await tx.update(deals).set({ customerId, updatedAt: new Date() }).where(eq(deals.id, d.id));
    return { ok: true as const, customerId, created };
  });
}

export async function linkDealCustomer(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Piste introuvable." };
  const r = await ensureCustomer(ctx, id);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: r.created ? "Fiche client créée." : "Piste reliée à la fiche client.", url: `/app/clients/${r.customerId}` };
}

/** Faire un devis : la fiche client est prête, la piste passe en « Devis envoyé », puis on ouvre l'éditeur de devis. */
export async function quoteFromDeal(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!ctx.can("invoices.manage")) return { ok: false, error: "Vous n'avez pas le droit de créer des devis." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Piste introuvable." };
  const r = await ensureCustomer(ctx, id);
  if (!r.ok) return r;
  const [d] = await db.select({ stage: deals.stage, title: deals.title, value: deals.valueCents }).from(deals).where(and(eq(deals.id, id), eq(deals.businessId, ctx.business.id)));
  if (d && (d.stage === "lead" || d.stage === "contacted")) await moveDeal(id, "quote").catch((e) => console.error("[ventes] étape devis :", e));
  // Devis prérempli avec le titre et le montant de la piste (montant = hors TVA, à ajuster dans le devis).
  if (d) {
    const seller = await getSellerSettings(ctx.business.id);
    const doc = await saveDocument({ docType: "quote", customerId: r.customerId, issueDate: todayIso(ctx.business.timezone), notes: "", lines: [{ ...newLine(), desc: d.title, qty: 1, unit: "forfait", price: d.value / 100, vat: seller.vatRegime === "franchise" ? 0 : 21 }] }).catch(() => null);
    if (doc?.ok && doc.id) { refresh(); return { ok: true, url: `/app/factures/${doc.id}` }; }
  }
  refresh();
  return { ok: true, url: `/app/factures/nouvelle?type=devis&client=${r.customerId}` };
}

/** Lecture de l'historique d'une piste (panneau latéral). */
export async function dealDetail(id: string) {
  const ctx = await requireContext(undefined, { app: "ventes" });
  if (!salesRights(ctx).view || !z.uuid().safeParse(id).success) return null;
  return dealDetailFor(ctx.business.id, id, ctx.can("invoices.view"));
}
