"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { shopOrders, shopSettings } from "@/db/schema";
import { SHOP_STATUS, isShopStatus } from "@/lib/shop";
import { parseEuros } from "@/lib/stock";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { cancelShopOrderAndRestock, shopOrigin, shopRights } from "@/server/shop";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/boutique", "layout");

const schema = z.object({
  enabled: z.boolean(),
  pickup: z.boolean(),
  pickupNote: z.string().trim().max(300),
  delivery: z.boolean(),
  deliveryPrice: z.string(),
  freeFrom: z.string(),
  deliveryNote: z.string().trim().max(300),
  payOnline: z.boolean(),
  payOnPickup: z.boolean(),
  payTransfer: z.boolean(),
  intro: z.string().trim().max(500),
});

export async function saveShopSettings(input: z.input<typeof schema>): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "boutique" });
  if (ctx.impersonating) return SUPERVISION;
  if (!shopRights(ctx).manage) return { ok: false, error: "Seul le responsable règle la boutique." };
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: "Réglages invalides." };
  const d = v.data;
  const price = d.deliveryPrice.trim() ? parseEuros(d.deliveryPrice) : 0;
  const free = d.freeFrom.trim() ? parseEuros(d.freeFrom) : null;
  if (price === null || (d.freeFrom.trim() && free === null)) return { ok: false, error: "Montant de livraison invalide." };
  if (d.enabled && !d.pickup && !d.delivery) return { ok: false, error: "Proposez au moins le retrait ou la livraison." };
  if (d.enabled && !d.payOnline && !d.payOnPickup && !d.payTransfer) return { ok: false, error: "Proposez au moins un moyen de paiement." };
  const values = { enabled: d.enabled, pickup: d.pickup, pickupNote: d.pickupNote || null, delivery: d.delivery, deliveryCents: price, freeDeliveryFromCents: free, deliveryNote: d.deliveryNote || null, payOnline: d.payOnline, payOnPickup: d.payOnPickup, payTransfer: d.payTransfer, intro: d.intro || null, updatedAt: new Date() };
  await db.insert(shopSettings).values({ businessId: ctx.business.id, ...values }).onConflictDoUpdate({ target: shopSettings.businessId, set: values });
  refresh();
  return { ok: true, message: d.enabled ? "Boutique enregistrée et ouverte." : "Réglages enregistrés (boutique fermée)." };
}

/** Avancer une commande (prête, expédiée, terminée) ; le client est prévenu par email pour « prête » et « expédiée ». */
export async function setShopOrderStatus(id: string, status: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "boutique" });
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success || !isShopStatus(status) || status === "cancelled" || status === "pending_payment") return { ok: false, error: "Commande introuvable." };
  // Seuls les passages prévus : nouvelle → prête / expédiée → terminée (jamais depuis une commande annulée ou non payée).
  const from = status === "done" ? ["ready", "shipped"] : ["new"];
  const [o] = await db.update(shopOrders).set({ status, updatedAt: new Date() }).where(and(eq(shopOrders.id, id), eq(shopOrders.businessId, ctx.business.id), inArray(shopOrders.status, from))).returning();
  if (!o) return { ok: false, error: "Cette commande ne peut pas passer à cette étape." };
  if (status === "ready" || status === "shipped") await sendEmail({ to: o.email, ...emails.shopOrderStatus({ shopName: ctx.business.name, number: o.number, status: SHOP_STATUS[status].label, url: `${shopOrigin()}/commande/${o.token}` }), template: "shop_order_status", businessId: ctx.business.id }).catch(() => {});
  refresh();
  return { ok: true, message: `Commande n° ${o.number} : ${SHOP_STATUS[status].label.toLowerCase()}.` };
}

export async function markShopOrderPaid(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "boutique" });
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Commande introuvable." };
  const done = await db.update(shopOrders).set({ paidAt: new Date(), updatedAt: new Date() }).where(and(eq(shopOrders.id, id), eq(shopOrders.businessId, ctx.business.id), isNull(shopOrders.paidAt), inArray(shopOrders.status, ["new", "ready", "shipped", "done"]))).returning({ n: shopOrders.number });
  if (!done.length) return { ok: false, error: "Commande introuvable, annulée ou déjà encaissée." };
  refresh();
  return { ok: true, message: `Commande n° ${done[0]!.n} encaissée.` };
}

export async function cancelShopOrder(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "boutique" });
  if (ctx.impersonating) return SUPERVISION;
  if (!shopRights(ctx).manage) return { ok: false, error: "Seul le responsable peut annuler une commande." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Commande introuvable." };
  const [o] = await db.select({ id: shopOrders.id, paidAt: shopOrders.paidAt, payMethod: shopOrders.payMethod }).from(shopOrders).where(and(eq(shopOrders.id, id), eq(shopOrders.businessId, ctx.business.id)));
  if (!o) return { ok: false, error: "Commande introuvable." };
  await cancelShopOrderAndRestock(o.id, ctx.member.id);
  refresh();
  return { ok: true, message: o.paidAt && o.payMethod === "online" ? "Commande annulée, stock rendu. Remboursez le client depuis votre compte Stripe." : "Commande annulée, stock rendu." };
}
