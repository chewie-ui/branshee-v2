"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, giftCardUses, giftCards, loyaltyCards, loyaltyMoves, loyaltySettings } from "@/db/schema";
import { addMonths, giftCode, normalizeCode } from "@/lib/loyalty";
import { todayIn } from "@/lib/planning";
import { parseEuros } from "@/lib/stock";
import { requireContext, type AppContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { loyaltyOrigin, loyaltyRights, loyaltySettingsOf } from "@/server/loyalty";

type Result = { ok: true; message?: string; id?: string; code?: string; reward?: boolean } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/fidelite", "layout");

async function member(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext(undefined, { app: "fidelite" });
  return ctx.impersonating ? { ctx, error: SUPERVISION } : { ctx, error: null };
}

export async function saveLoyaltySettings(input: { goal: number; reward: string }): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!loyaltyRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie le programme." };
  const v = z.object({ goal: z.number().int().min(2).max(50), reward: z.string().trim().min(2, "Décrivez la récompense.").max(120) }).safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Réglages invalides." };
  await db.insert(loyaltySettings).values({ businessId: ctx.business.id, ...v.data }).onConflictDoUpdate({ target: loyaltySettings.businessId, set: { ...v.data, updatedAt: new Date() } });
  refresh();
  return { ok: true, message: "Programme enregistré." };
}

/**
 * Un passage = un tampon sur la carte du client (créée au premier passage). Pas plus d'un tampon par client
 * toutes les 2 heures, contre les doubles clics. La récompense se débloque à l'objectif.
 */
export async function addStamp(customerId: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!z.uuid().safeParse(customerId).success) return { ok: false, error: "Client introuvable." };
  const [c] = await db.select({ id: customers.id, name: customers.fullName, email: customers.email }).from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, ctx.business.id)));
  if (!c) return { ok: false, error: "Client introuvable." };
  const s = await loyaltySettingsOf(ctx.business.id);
  const r = await db.transaction(async (tx) => {
    await tx.insert(loyaltyCards).values({ businessId: ctx.business.id, customerId: c.id, token: randomBytes(16).toString("base64url") }).onConflictDoNothing();
    const [card] = await tx.select().from(loyaltyCards).where(and(eq(loyaltyCards.businessId, ctx.business.id), eq(loyaltyCards.customerId, c.id))).for("update");
    if (card!.lastStampAt && Date.now() - card!.lastStampAt.getTime() < 2 * 3600_000) return { ok: false as const, error: `${c.name} a déjà reçu un tampon il y a moins de 2 heures.` };
    const stamps = card!.stamps + 1;
    await tx.update(loyaltyCards).set({ stamps, lastStampAt: new Date(), updatedAt: new Date() }).where(eq(loyaltyCards.id, card!.id));
    await tx.insert(loyaltyMoves).values({ businessId: ctx.business.id, cardId: card!.id, delta: 1, kind: "stamp", memberId: ctx.member.id });
    return { ok: true as const, stamps, token: card!.token, first: card!.stamps === 0 && !card!.lastStampAt };
  });
  if (!r.ok) return r;
  // Premier tampon : le client reçoit le lien de sa carte (à garder sur son téléphone).
  if (r.first && c.email) await sendEmail({ to: c.email, ...emails.loyaltyWelcome({ businessName: ctx.business.name, goal: s.goal, reward: s.reward, url: `${loyaltyOrigin()}/fidelite/${r.token}` }), template: "loyalty_welcome", businessId: ctx.business.id }).catch(() => {});
  refresh();
  const ready = r.stamps >= s.goal;
  return { ok: true, reward: ready, message: ready ? `${c.name} a ${r.stamps} tampons : récompense débloquée (${s.reward}) !` : `Tampon ajouté : ${r.stamps}/${s.goal} pour ${c.name}.` };
}

/** La récompense est utilisée : on retire l'objectif du solde. */
export async function redeemReward(cardId: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!z.uuid().safeParse(cardId).success) return { ok: false, error: "Carte introuvable." };
  const s = await loyaltySettingsOf(ctx.business.id);
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(loyaltyCards).where(and(eq(loyaltyCards.id, cardId), eq(loyaltyCards.businessId, ctx.business.id))).for("update");
    if (!card) return { ok: false as const, error: "Carte introuvable." };
    if (card.stamps < s.goal) return { ok: false as const, error: `Encore ${s.goal - card.stamps} tampon${s.goal - card.stamps > 1 ? "s" : ""} avant la récompense.` };
    await tx.update(loyaltyCards).set({ stamps: card.stamps - s.goal, rewardsEarned: card.rewardsEarned + 1, updatedAt: new Date() }).where(eq(loyaltyCards.id, card.id));
    await tx.insert(loyaltyMoves).values({ businessId: ctx.business.id, cardId: card.id, delta: -s.goal, kind: "reward", memberId: ctx.member.id });
    refresh();
    return { ok: true as const, message: `Récompense utilisée : ${s.reward}.` };
  });
}

/* ───────── Cartes cadeaux ───────── */

const giftSchema = z.object({
  amount: z.string(),
  buyerName: z.string().trim().max(120),
  recipientName: z.string().trim().max(120),
  message: z.string().trim().max(300),
  months: z.number().int().min(12, "Une carte cadeau doit rester valable au moins 1 an.").max(60),
});

export async function createGiftCard(input: z.input<typeof giftSchema>): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  // Une carte cadeau vaut de l'argent : seul le responsable (ou qui gère les réglages) en crée.
  if (!loyaltyRights(ctx).manage) return { ok: false, error: "Seul le responsable peut créer une carte cadeau." };
  const v = giftSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez la carte." };
  const cents = parseEuros(v.data.amount);
  if (!cents || cents < 100 || cents > 1_000_000) return { ok: false, error: "Montant entre 1 € et 10 000 €." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(giftCards).where(and(eq(giftCards.businessId, ctx.business.id), gte(giftCards.createdAt, new Date(Date.now() - 86400_000))));
  if (n >= 200) return { ok: false, error: "200 cartes par jour maximum." };
  const expiresOn = addMonths(todayIn(ctx.business.timezone), v.data.months);
  for (let i = 0; i < 5; i++) {
    const code = giftCode((k) => randomBytes(k));
    const [row] = await db.insert(giftCards).values({ businessId: ctx.business.id, code, initialCents: cents, balanceCents: cents, buyerName: v.data.buyerName || null, recipientName: v.data.recipientName || null, message: v.data.message || null, expiresOn, createdById: ctx.member.id }).onConflictDoNothing().returning({ id: giftCards.id });
    if (row) { refresh(); return { ok: true, id: row.id, code, message: `Carte cadeau ${code} créée.` }; }
  }
  return { ok: false, error: "Réessayez." };
}

/** Utiliser tout ou partie du solde d'une carte (code tapé ou scanné). */
export async function redeemGiftCard(input: { code: string; amount: string; note?: string }): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  const code = normalizeCode(input.code);
  const cents = parseEuros(input.amount);
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return { ok: false, error: "Code invalide (format ABCD-EFGH)." };
  if (!cents) return { ok: false, error: "Montant invalide." };
  const today = todayIn(ctx.business.timezone);
  return db.transaction(async (tx) => {
    const [g] = await tx.select().from(giftCards).where(and(eq(giftCards.businessId, ctx.business.id), eq(giftCards.code, code))).for("update");
    if (!g) return { ok: false as const, error: "Aucune carte avec ce code." };
    if (g.cancelledAt) return { ok: false as const, error: "Cette carte a été annulée." };
    if (g.expiresOn < today) return { ok: false as const, error: `Carte expirée le ${g.expiresOn.split("-").reverse().join("/")}.` };
    if (cents > g.balanceCents) return { ok: false as const, error: `Solde insuffisant : il reste ${(g.balanceCents / 100).toFixed(2).replace(".", ",")} €.` };
    await tx.update(giftCards).set({ balanceCents: g.balanceCents - cents, updatedAt: new Date() }).where(eq(giftCards.id, g.id));
    await tx.insert(giftCardUses).values({ businessId: ctx.business.id, giftCardId: g.id, amountCents: cents, note: input.note?.trim().slice(0, 200) || null, memberId: ctx.member.id });
    refresh();
    return { ok: true as const, message: `${(cents / 100).toFixed(2).replace(".", ",")} € utilisés. Reste ${((g.balanceCents - cents) / 100).toFixed(2).replace(".", ",")} € sur ${code}.` };
  });
}

export async function cancelGiftCard(id: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!loyaltyRights(ctx).manage) return { ok: false, error: "Seul le responsable peut annuler une carte." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Carte introuvable." };
  await db.update(giftCards).set({ cancelledAt: new Date(), updatedAt: new Date() }).where(and(eq(giftCards.id, id), eq(giftCards.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Carte annulée." };
}
