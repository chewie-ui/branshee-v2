"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { customers, giftCardUses, giftCards, loyaltyCards, loyaltyMoves, loyaltySettings } from "@/db/schema";
import { addMonths, giftCode, normalizeCode } from "@/lib/loyalty";
import { todayIn } from "@/lib/planning";
import { parseEuros } from "@/lib/stock";
import { requireContext, type AppContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import QRCode from "qrcode";
import { QR_STEP_MS, qrSign, qrWindow } from "@/lib/loyalty-qr";
import { giveStamp, loyaltyOrigin, loyaltyQrKey, loyaltyRights, loyaltySettingsOf, sendLoyaltyWelcome } from "@/server/loyalty";

type Result = { ok: true; message?: string; id?: string; code?: string; reward?: boolean } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/fidelite", "layout");

async function member(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext(undefined, { app: "fidelite" });
  return ctx.impersonating ? { ctx, error: SUPERVISION } : { ctx, error: null };
}

const settingsSchema = z.object({
  goal: z.number().int().min(2).max(50),
  reward: z.string().trim().min(2, "Décrivez la récompense.").max(120),
  autoAppointment: z.boolean().optional(),
  autoShop: z.boolean().optional(),
  qrEnabled: z.boolean().optional(),
});

export async function saveLoyaltySettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!loyaltyRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie le programme." };
  const v = settingsSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Réglages invalides." };
  const cur = await loyaltySettingsOf(ctx.business.id);
  const values = { goal: v.data.goal, reward: v.data.reward, autoAppointment: v.data.autoAppointment ?? cur.autoAppointment, autoShop: v.data.autoShop ?? cur.autoShop, qrEnabled: v.data.qrEnabled ?? cur.qrEnabled };
  await db.insert(loyaltySettings).values({ businessId: ctx.business.id, ...values }).onConflictDoUpdate({ target: loyaltySettings.businessId, set: { ...values, updatedAt: new Date() } });
  refresh();
  return { ok: true, message: "Programme enregistré." };
}

/** Un passage = un tampon sur la carte du client (créée au premier passage). La récompense se débloque à l'objectif. */
export async function addStamp(customerId: string): Promise<Result> {
  const { ctx, error } = await member();
  if (error) return error;
  if (!z.uuid().safeParse(customerId).success) return { ok: false, error: "Client introuvable." };
  const [c] = await db.select({ id: customers.id, name: customers.fullName, email: customers.email }).from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, ctx.business.id)));
  if (!c) return { ok: false, error: "Client introuvable." };
  const r = await giveStamp({ businessId: ctx.business.id, timezone: ctx.business.timezone, customerId: c.id, source: "manual", memberId: ctx.member.id });
  if (!r.ok) return { ok: false, error: `${c.name} a déjà reçu un tampon il y a moins de 2 heures.` };
  if (r.first) await sendLoyaltyWelcome(ctx.business.id, ctx.business.name, c.email, r.token, r.goal, r.reward);
  refresh();
  const ready = r.stamps >= r.goal;
  return { ok: true, reward: ready, message: ready ? `${c.name} a ${r.stamps} tampons : récompense débloquée (${r.reward}) !` : `Tampon ajouté : ${r.stamps}/${r.goal} pour ${c.name}.` };
}

/** QR code « tampon » du moment, affiché sur l'écran du pro (il change toutes les 30 secondes). */
export async function currentLoyaltyQr(): Promise<{ ok: true; url: string; svg: string; expiresIn: number } | { ok: false; error: string }> {
  const { ctx, error } = await member();
  if (error) return error;
  const s = await loyaltySettingsOf(ctx.business.id);
  if (!s.qrEnabled) return { ok: false, error: "Activez d'abord le tampon par QR code dans votre programme." };
  const w = qrWindow();
  const url = `${loyaltyOrigin()}/fidelite/tampon?b=${ctx.business.id}&w=${w}&s=${qrSign(loyaltyQrKey(), ctx.business.id, w)}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111827", light: "#ffffff" } });
  return { ok: true, url, svg, expiresIn: QR_STEP_MS - (Date.now() % QR_STEP_MS) };
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
