import "server-only";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses, customers, salesDocuments, shopOrders, type SalesLine } from "@/db/schema";
import { splitBeAddress } from "@/lib/address";
import { formatNumber, newLine, noVat, settingsMissing, structComm, todayIso, totals } from "@/lib/invoicing";
import { clientSnapshot, getSellerSettings, sellerSnapshot } from "@/server/invoicing";

export type OrderAddress = { street: string; postalCode: string; city: string; company?: string; vatNumber?: string };
export type OrderInvoiceResult = { ok: true; invoiceId: string } | { ok: false; reason: "not_paid" | "not_configured" | "address" | "not_found"; error: string };

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Facture d'une commande de la boutique, émise au nom du pro qui vend.
 * Automatique quand la commande est payée et que l'adresse du client est connue (livraison) ;
 * sinon le client la demande depuis sa commande en donnant son adresse (mention légale obligatoire).
 * Idempotent : une commande n'a jamais qu'une facture.
 */
export async function issueOrderInvoice(orderId: string, address?: OrderAddress): Promise<OrderInvoiceResult> {
  const [o] = await db.select({ o: shopOrders, tz: businesses.timezone }).from(shopOrders).innerJoin(businesses, eq(businesses.id, shopOrders.businessId)).where(eq(shopOrders.id, orderId));
  if (!o) return { ok: false, reason: "not_found", error: "Commande introuvable." };
  const order = o.o;
  if (order.invoiceId) return { ok: true, invoiceId: order.invoiceId };
  if (!order.paidAt || order.status === "cancelled" || order.status === "pending_payment") return { ok: false, reason: "not_paid", error: "La facture est disponible une fois la commande payée." };

  const seller = await getSellerSettings(order.businessId);
  if (!seller.saved || settingsMissing(seller).length) return { ok: false, reason: "not_configured", error: "Ce commerçant n'a pas encore activé ses factures en ligne. Contactez-le pour l'obtenir." };

  const addr = address ?? splitBeAddress(order.address);
  if (!addr || !addr.street.trim() || !/^\d{4,5}$/.test(addr.postalCode.trim()) || !addr.city.trim()) return { ok: false, reason: "address", error: "Indiquez votre adresse : elle doit figurer sur la facture." };
  const company = address?.company?.trim() || null;
  const vatNumber = address?.vatNumber?.trim() || null;
  if (company && !vatNumber) return { ok: false, reason: "address", error: "Pour une société, indiquez aussi son numéro de TVA ou d'entreprise." };

  // Fiche client du pro (créée si besoin), avec l'adresse de facturation.
  const email = order.email.trim().toLowerCase();
  const [existing] = await db.select().from(customers).where(and(eq(customers.businessId, order.businessId), sql`lower(${customers.email}) = ${email}`)).limit(1);
  const billing = { street: addr.street.trim(), postalCode: addr.postalCode.trim(), city: addr.city.trim(), ...(company ? { companyName: company, vatNumber } : {}) };
  const customer = existing
    ? (await db.update(customers).set({ ...billing, updatedAt: new Date() }).where(eq(customers.id, existing.id)).returning())[0]!
    : (await db.insert(customers).values({ businessId: order.businessId, fullName: order.name, email, phone: order.phone, createdManually: false, ...billing }).returning())[0]!;

  // Lignes : prix de la boutique TVAC → prix unitaire HTVA si le pro est assujetti.
  const vatFree = noVat(seller.vatRegime);
  const toLine = (desc: string, qty: number, ttcCents: number, rate: number): SalesLine => ({ ...newLine(), desc, qty, unit: "pièce", price: vatFree ? ttcCents / 100 : r4(ttcCents / 100 / (1 + rate / 100)), vat: vatFree ? 0 : rate });
  const lines = order.lines.map((l) => toLine(l.name, l.qty, l.unitCents, l.vatRate));
  if (order.deliveryCents > 0) {
    const rate = Math.max(0, ...order.lines.map((l) => l.vatRate));
    lines.push({ ...toLine("Livraison", 1, order.deliveryCents, rate), unit: "forfait" });
  }
  const t = totals(lines, seller.vatRegime);
  const today = todayIso(o.tz || "Europe/Brussels");
  const year = Number(today.slice(0, 4));
  const serviceDate = new Intl.DateTimeFormat("en-CA", { timeZone: o.tz || "Europe/Brussels" }).format(order.paidAt);

  const res = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`order-invoice:${order.id}`}))`);
    const [fresh] = await tx.select({ invoiceId: shopOrders.invoiceId }).from(shopOrders).where(eq(shopOrders.id, order.id));
    if (fresh?.invoiceId) return fresh.invoiceId;
    // Même verrou et même numérotation continue que les factures émises depuis l'app Factures.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${order.businessId + ":invoice:" + year}))`);
    const [last] = await tx
      .select({ seq: salesDocuments.seq })
      .from(salesDocuments)
      .where(and(eq(salesDocuments.businessId, order.businessId), eq(salesDocuments.docType, "invoice"), eq(salesDocuments.year, year), isNotNull(salesDocuments.seq)))
      .orderBy(desc(salesDocuments.seq))
      .limit(1);
    const seq = (last?.seq ?? 0) + 1;
    const number = formatNumber("invoice", year, seq, seller.prefix);
    const [doc] = await tx
      .insert(salesDocuments)
      .values({
        businessId: order.businessId,
        docType: "invoice",
        status: "paid",
        year,
        seq,
        number,
        comm: structComm(year, seq, "invoice"),
        customerId: customer.id,
        client: clientSnapshot(customer),
        seller: sellerSnapshot(seller),
        issueDate: today,
        serviceDate,
        dueDate: today,
        notes: `Commande n° ${order.number} — payée${order.payMethod === "online" ? " en ligne" : ""}.`,
        lines,
        htCents: Math.round(t.ht * 100),
        vatCents: Math.round(t.tva * 100),
        ttcCents: Math.round(t.ttc * 100),
        paidDate: serviceDate,
        paidMethod: order.payMethod === "online" ? "Carte (en ligne)" : order.payMethod === "transfer" ? "Virement" : "Au retrait",
        issuedAt: new Date(),
      })
      .returning({ id: salesDocuments.id });
    await tx.update(shopOrders).set({ invoiceId: doc!.id, updatedAt: new Date() }).where(and(eq(shopOrders.id, order.id), isNull(shopOrders.invoiceId)));
    await tx.insert(activityLogs).values({ businessId: order.businessId, actorName: "Skydev", action: "invoice.issue", description: `Facture émise automatiquement : ${number} (commande n° ${order.number})` });
    return doc!.id;
  });
  return { ok: true, invoiceId: res };
}

/** Émission automatique après paiement : silencieuse si l'adresse manque ou si les factures ne sont pas configurées. */
export async function autoInvoiceOrder(orderId: string) {
  try {
    await issueOrderInvoice(orderId);
  } catch (e) {
    console.error("[order-invoice]", orderId, e);
  }
}

/**
 * Commande annulée après facturation : une facture émise ne se supprime pas, on émet une note de crédit
 * du même montant (numérotation continue des notes de crédit) et la facture passe en « annulée ».
 */
export async function creditOrderInvoice(orderId: string) {
  const [order] = await db.select().from(shopOrders).where(eq(shopOrders.id, orderId));
  if (!order?.invoiceId) return null;
  const [inv] = await db.select().from(salesDocuments).where(and(eq(salesDocuments.id, order.invoiceId), eq(salesDocuments.businessId, order.businessId)));
  if (!inv || inv.docType !== "invoice" || inv.status === "cancelled" || !inv.number) return null;
  const [b] = await db.select({ tz: businesses.timezone }).from(businesses).where(eq(businesses.id, order.businessId));
  const today = todayIso(b?.tz || "Europe/Brussels");
  const year = Number(today.slice(0, 4));
  const seller = await getSellerSettings(order.businessId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${order.businessId + ":credit:" + year}))`);
    const [already] = await tx.select({ id: salesDocuments.id }).from(salesDocuments).where(and(eq(salesDocuments.relatedId, inv.id), eq(salesDocuments.docType, "credit"), isNotNull(salesDocuments.seq)));
    if (already) return already.id;
    const [last] = await tx
      .select({ seq: salesDocuments.seq })
      .from(salesDocuments)
      .where(and(eq(salesDocuments.businessId, order.businessId), eq(salesDocuments.docType, "credit"), eq(salesDocuments.year, year), isNotNull(salesDocuments.seq)))
      .orderBy(desc(salesDocuments.seq))
      .limit(1);
    const seq = (last?.seq ?? 0) + 1;
    const number = formatNumber("credit", year, seq, seller.prefix);
    const [cn] = await tx
      .insert(salesDocuments)
      .values({
        businessId: order.businessId,
        docType: "credit",
        status: "sent",
        year,
        seq,
        number,
        customerId: inv.customerId,
        client: inv.client,
        seller: inv.seller,
        issueDate: today,
        notes: `Annulation de la commande n° ${order.number}.`,
        lines: inv.lines,
        htCents: inv.htCents,
        vatCents: inv.vatCents,
        ttcCents: inv.ttcCents,
        relatedId: inv.id,
        issuedAt: new Date(),
      })
      .returning({ id: salesDocuments.id });
    await tx.update(salesDocuments).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(salesDocuments.id, inv.id));
    await tx.insert(activityLogs).values({ businessId: order.businessId, actorName: "Skydev", action: "invoice.issue", description: `Note de crédit émise automatiquement : ${number} (commande n° ${order.number} annulée)` });
    return cn!.id;
  });
}
