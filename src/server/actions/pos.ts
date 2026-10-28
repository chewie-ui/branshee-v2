"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, posSales, posSessions, products, stockMoves, type PosLine } from "@/db/schema";
import { VAT_RATES, cartTotals, ticketNumber } from "@/lib/stock";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { openSessionOf, sessionTotals, stockRights } from "@/server/stock";

type Result = { ok: true; message?: string; id?: string; number?: string; change?: number | null } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => { revalidatePath("/app/caisse", "layout"); revalidatePath("/app/stock", "layout"); };
const cents = z.number().int().min(0).max(100_000_000);

export async function openRegister(openingCashCents: number): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!cents.safeParse(openingCashCents).success) return { ok: false, error: "Fond de caisse invalide." };
  if (await openSessionOf(ctx.business.id)) return { ok: false, error: "La caisse est déjà ouverte." };
  try {
    await db.insert(posSessions).values({ businessId: ctx.business.id, openedById: ctx.member.id, openingCashCents });
  } catch {
    return { ok: false, error: "La caisse est déjà ouverte." };
  }
  refresh();
  return { ok: true, message: "Caisse ouverte. Bonnes ventes !" };
}

/** Clôture : espèces attendues (fond + ventes en espèces − remboursements en espèces) comparées au comptage. */
export async function closeRegister(input: { countedCashCents: number; note: string }): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!cents.safeParse(input.countedCashCents).success) return { ok: false, error: "Montant compté invalide." };
  const s = await openSessionOf(ctx.business.id);
  if (!s) return { ok: false, error: "La caisse n'est pas ouverte." };
  const t = await sessionTotals(ctx.business.id, s.id);
  const expected = s.openingCashCents + t.cash;
  const done = await db.update(posSessions).set({ closedAt: new Date(), closedById: ctx.member.id, countedCashCents: input.countedCashCents, expectedCashCents: expected, note: input.note.trim().slice(0, 500) || null }).where(and(eq(posSessions.id, s.id), isNull(posSessions.closedAt))).returning({ id: posSessions.id });
  if (!done.length) return { ok: false, error: "La caisse est déjà clôturée." };
  refresh();
  const diff = input.countedCashCents - expected;
  return { ok: true, id: s.id, message: diff === 0 ? "Caisse clôturée : le compte est juste." : `Caisse clôturée. Écart : ${(diff / 100).toFixed(2).replace(".", ",")} €.` };
}

const saleSchema = z.object({
  lines: z.array(z.object({
    productId: z.uuid().nullable(),
    qty: z.number().int().min(1).max(999),
    name: z.string().trim().max(120).optional(),
    unitCents: cents.optional(),
    vatRate: z.number().optional(),
  })).min(1, "Le ticket est vide.").max(100),
  discountCents: cents.default(0),
  method: z.enum(["cash", "card", "other"]),
  cashGivenCents: cents.nullable().optional(),
  customerId: z.uuid().nullable().optional(),
});

/**
 * Encaisser un ticket. Les prix des produits viennent de la base ; une ligne libre (« Divers ») garde le montant tapé.
 * Numérotation continue par année (verrou), stock décompté pour les produits suivis.
 */
export async function sell(input: z.input<typeof saleSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = saleSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Ticket invalide." };
  const d = v.data;
  const session = await openSessionOf(ctx.business.id);
  if (!session) return { ok: false, error: "Ouvrez la caisse avant d'encaisser." };
  const ids = [...new Set(d.lines.map((l) => l.productId).filter((x): x is string => !!x))];
  const found = ids.length ? await db.select().from(products).where(and(eq(products.businessId, ctx.business.id), inArray(products.id, ids))) : [];
  const byId = new Map(found.map((p) => [p.id, p]));
  const lines: PosLine[] = [];
  for (const l of d.lines) {
    if (l.productId) {
      const p = byId.get(l.productId);
      if (!p || !p.active) return { ok: false, error: "Un produit du ticket n'existe plus. Retirez-le." };
      lines.push({ productId: p.id, name: p.name, qty: l.qty, unitCents: p.priceCents, vatRate: p.vatRate });
    } else {
      if (!l.name || l.unitCents === undefined || !(VAT_RATES as readonly number[]).includes(l.vatRate ?? -1)) return { ok: false, error: "Ligne libre incomplète." };
      lines.push({ productId: null, name: l.name, qty: l.qty, unitCents: l.unitCents, vatRate: l.vatRate! });
    }
  }
  if (d.discountCents && !stockRights(ctx).manage && d.discountCents > 0) {
    // Les remises restent possibles pour l'équipe, mais limitées à 50 % du ticket.
    const gross = lines.reduce((a, l) => a + l.qty * l.unitCents, 0);
    if (d.discountCents > gross / 2) return { ok: false, error: "Remise trop importante : demandez au responsable." };
  }
  const t = cartTotals(lines, d.discountCents);
  if (d.method === "cash" && d.cashGivenCents != null && d.cashGivenCents < t.total) return { ok: false, error: "Montant reçu insuffisant." };
  if (d.customerId) {
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, d.customerId), eq(customers.businessId, ctx.business.id)));
    if (!c) return { ok: false, error: "Client introuvable." };
  }
  const year = Number(todayIn(ctx.business.timezone).slice(0, 4));
  const sale = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${ctx.business.id}:pos:${year}`}))`);
    const [m] = await tx.select({ m: sql<number>`coalesce(max(${posSales.seq}), 0)::int` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), eq(posSales.year, year)));
    const seq = (m?.m ?? 0) + 1;
    const [row] = await tx.insert(posSales).values({ businessId: ctx.business.id, sessionId: session.id, year, seq, number: ticketNumber(year, seq), lines, discountCents: t.discount, totalCents: t.total, vatCents: t.vat, method: d.method, cashGivenCents: d.method === "cash" ? (d.cashGivenCents ?? null) : null, customerId: d.customerId ?? null, memberId: ctx.member.id }).returning({ id: posSales.id, number: posSales.number });
    const qtyBy = new Map<string, number>();
    for (const l of lines) if (l.productId && byId.get(l.productId)!.trackStock) qtyBy.set(l.productId, (qtyBy.get(l.productId) ?? 0) + l.qty);
    for (const [pid, q] of qtyBy) {
      await tx.update(products).set({ stockQty: sql`${products.stockQty} - ${q}`, updatedAt: new Date() }).where(and(eq(products.id, pid), eq(products.businessId, ctx.business.id)));
      await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: pid, delta: -q, reason: "sale", note: row!.number, memberId: ctx.member.id, saleId: row!.id });
    }
    return row!;
  });
  refresh();
  const change = d.method === "cash" && d.cashGivenCents != null ? d.cashGivenCents - t.total : null;
  return { ok: true, id: sale.id, number: sale.number, change, message: `Ticket ${sale.number} encaissé.` };
}

/** Rembourser un ticket (responsable) : les produits reviennent en stock. */
export async function refundSale(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!stockRights(ctx).manage) return { ok: false, error: "Seul le responsable peut rembourser un ticket." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Ticket introuvable." };
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(posSales).where(and(eq(posSales.id, id), eq(posSales.businessId, ctx.business.id))).for("update");
    if (!s) return { ok: false as const, error: "Ticket introuvable." };
    if (s.status === "refunded") return { ok: false as const, error: "Ticket déjà remboursé." };
    await tx.update(posSales).set({ status: "refunded", refundedAt: new Date() }).where(eq(posSales.id, s.id));
    const moves = await tx.select({ productId: stockMoves.productId, delta: stockMoves.delta }).from(stockMoves).where(and(eq(stockMoves.saleId, s.id), eq(stockMoves.reason, "sale")));
    for (const mv of moves) {
      await tx.update(products).set({ stockQty: sql`${products.stockQty} + ${-mv.delta}`, lowNotifiedAt: null, updatedAt: new Date() }).where(and(eq(products.id, mv.productId), eq(products.businessId, ctx.business.id)));
      await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: mv.productId, delta: -mv.delta, reason: "refund", note: s.number, memberId: ctx.member.id, saleId: s.id });
    }
    refresh();
    return { ok: true as const, message: `Ticket ${s.number} remboursé.` };
  });
}
