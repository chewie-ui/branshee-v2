"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isDay } from "@/lib/planning";
import { db } from "@/db";
import { activityLogs, appointments, customers, invoiceProducts, invoiceSettings, salesDocuments, type SalesLine } from "@/db/schema";
import { addDays, bceValid, cleanLines, clientMissing, formatNumber, ibanValid, money, newLine, num, settingsMissing, structComm, todayIso, totals, type DocType } from "@/lib/invoicing";
import { requireContext, type AppContext } from "@/server/context";
import { getDocument, getSellerSettings } from "@/server/invoicing";
import { signedSignature } from "@/server/signatures";

type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const uuid = z.uuid();
const isoDate = z.string().refine(isDay, "Date invalide.");
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const log = (ctx: AppContext, action: string, description: string) => db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });
const refresh = () => revalidatePath("/app/factures", "layout");

const lineSchema = z.object({
  id: z.string().max(40).default(""),
  desc: z.string().max(2000).default(""),
  qty: z.coerce.number().min(0).max(1_000_000),
  unit: z.string().max(30).default("forfait"),
  price: z.coerce.number().min(-10_000_000).max(10_000_000),
  vat: z.coerce.number().refine((v) => [0, 6, 12, 21].includes(v), "Taux de TVA invalide"),
});

const docSchema = z.object({
  id: uuid.optional(),
  docType: z.enum(["invoice", "credit", "quote"]),
  customerId: uuid.nullable(),
  issueDate: isoDate,
  serviceDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  validUntil: isoDate.nullable().optional(),
  notes: z.string().max(2000).default(""),
  lines: z.array(lineSchema).max(200),
  relatedId: uuid.nullable().optional(),
  appointmentId: uuid.nullable().optional(),
});
export type DocInput = z.input<typeof docSchema>;

function clientSnapshot(c: typeof customers.$inferSelect) {
  return { name: c.companyName || c.fullName, contact: c.companyName ? c.fullName : "", email: c.email ?? "", phone: c.phone ?? "", vat: c.vatNumber ?? "", street: c.street ?? "", zip: c.postalCode ?? "", city: c.city ?? "", country: c.country ?? "" };
}

const billingOf = (c: typeof customers.$inferSelect) => ({ name: c.fullName, company: c.companyName, vatNumber: c.vatNumber, street: c.street, postalCode: c.postalCode, city: c.city });

async function ownCustomer(businessId: string, id: string | null | undefined) {
  if (!id) return null;
  const [c] = await db.select().from(customers).where(and(eq(customers.businessId, businessId), eq(customers.id, id)));
  return c ?? null;
}

/**
 * Enregistre un brouillon de facture ou de note de crédit, ou un devis (modifiable tant qu'il n'est pas facturé).
 * Un devis reçoit son numéro (D-AAAA-NNN) au premier enregistrement, comme dans Comptoir.
 */
export async function saveDocument(input: DocInput): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const parsed = docSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Vérifiez les champs du document." };
  const v = parsed.data;
  const seller = await getSellerSettings(ctx.business.id);
  const lines = cleanLines(v.lines as SalesLine[]).map((l) => ({ ...l, id: l.id || newLine().id }));
  const customer = await ownCustomer(ctx.business.id, v.customerId);
  if (v.customerId && !customer) return { ok: false, error: "Client introuvable." };
  if (v.docType === "quote") {
    if (!customer) return { ok: false, error: "Choisissez un client." };
    if (!lines.some((l) => l.desc.trim())) return { ok: false, error: "Ajoutez au moins une prestation avec une description." };
    if (v.validUntil && v.validUntil < v.issueDate) return { ok: false, error: "La date de validité doit être après la date du devis." };
  } else {
    if (!customer) return { ok: false, error: "Choisissez un client avant d'enregistrer." };
    // Facture légale : toutes les mentions obligatoires, du vendeur comme du client, avant même le brouillon.
    const sm = settingsMissing(seller);
    if (!seller.saved || sm.length) return { ok: false, error: `Complétez d'abord ${sm.length ? sm.join(", ") : "vos informations de facturation"} dans les réglages de facturation.` };
    const cm = clientMissing(billingOf(customer));
    if (cm.length && v.docType === "invoice") return { ok: false, error: `Fiche client incomplète : ajoutez ${cm.join(", ")}.` };
  }
  const t = totals(lines, seller.vatRegime);
  const values = {
    customerId: customer?.id ?? null,
    issueDate: v.issueDate,
    serviceDate: v.docType === "invoice" ? (v.serviceDate ?? v.issueDate) : null,
    dueDate: v.docType === "invoice" ? (v.dueDate ?? addDays(v.issueDate, seller.paymentDays)) : null,
    validUntil: v.docType === "quote" ? (v.validUntil ?? addDays(v.issueDate, 30)) : null,
    notes: v.notes,
    lines,
    htCents: Math.round(t.ht * 100),
    vatCents: Math.round(t.tva * 100),
    ttcCents: Math.round(t.ttc * 100),
    // Un devis enregistré garde une copie du client et du vendeur, comme une facture émise.
    ...(v.docType === "quote" && customer ? { client: clientSnapshot(customer), seller: sellerSnapshot(seller) } : {}),
    updatedAt: new Date(),
  };

  if (v.id) {
    const d = await getDocument(ctx.business.id, v.id);
    if (!d || d.docType !== v.docType) return { ok: false, error: "Document introuvable." };
    if (d.docType !== "quote" && d.status !== "draft") return { ok: false, error: "Une facture émise ne peut plus être modifiée : faites une note de crédit." };
    if (d.docType === "quote" && d.status === "invoiced") return { ok: false, error: "Ce devis est déjà facturé." };
    if (d.docType === "quote" && (await signedSignature(d.id))) return { ok: false, error: "Ce devis est signé par le client : il ne peut plus être modifié. Dupliquez-le pour en faire un nouveau." };
    await db.update(salesDocuments).set(values).where(eq(salesDocuments.id, d.id));
    await log(ctx, "invoice.save", `${d.docType === "quote" ? "Devis" : "Brouillon"} modifié${d.number ? ` : ${d.number}` : ""}`);
    refresh();
    return { ok: true, id: d.id, message: d.docType === "quote" ? `Devis ${d.number} enregistré.` : "Brouillon enregistré." };
  }

  let numbering = {};
  if (v.docType === "quote") {
    const year = Number(v.issueDate.slice(0, 4));
    numbering = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.business.id + ":quote:" + year}))`);
      const [m] = await tx.select({ m: sql<number>`coalesce(max(${salesDocuments.seq}), 0)::int` }).from(salesDocuments).where(and(eq(salesDocuments.businessId, ctx.business.id), eq(salesDocuments.docType, "quote"), eq(salesDocuments.year, year)));
      const seq = (m?.m ?? 0) + 1;
      const [row] = await tx.insert(salesDocuments).values({ businessId: ctx.business.id, docType: "quote", status: "draft", year, seq, number: formatNumber("quote", year, seq), createdById: ctx.user.id, ...values }).returning({ id: salesDocuments.id, number: salesDocuments.number });
      return row!;
    });
    const row = numbering as { id: string; number: string };
    await log(ctx, "invoice.quote", `Devis créé : ${row.number}`);
    refresh();
    return { ok: true, id: row.id, message: `Devis ${row.number} enregistré.` };
  }
  // Une note de crédit ne se rattache qu'à une facture émise de cet établissement.
  const rel = v.docType === "credit" && v.relatedId ? await getDocument(ctx.business.id, v.relatedId) : null;
  const relatedId = rel && rel.docType === "invoice" && rel.number ? rel.id : null;
  const appointmentId = v.appointmentId ? ((await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.businessId, ctx.business.id), eq(appointments.id, v.appointmentId))))[0]?.id ?? null) : null;
  const [row] = await db.insert(salesDocuments).values({ businessId: ctx.business.id, docType: v.docType, status: "draft", relatedId, appointmentId, createdById: ctx.user.id, ...values }).returning({ id: salesDocuments.id });
  await log(ctx, "invoice.draft", v.docType === "credit" ? "Brouillon de note de crédit créé" : "Brouillon de facture créé");
  refresh();
  return { ok: true, id: row!.id, message: "Brouillon enregistré." };
}

function sellerSnapshot(s: Awaited<ReturnType<typeof getSellerSettings>>) {
  return { legalName: s.legalName, tradeName: s.tradeName, legalForm: s.legalForm, street: s.street, zip: s.zip, city: s.city, country: s.country, bce: s.bce, vatNumber: s.vatNumber, email: s.email, phone: s.phone, website: s.website, iban: s.iban, bic: s.bic, vatRegime: s.vatRegime, footerNote: s.footerNote, color: s.color };
}

/**
 * Émet une facture ou une note de crédit : numéro définitif continu (par type et par année), date chronologique,
 * communication structurée, copie figée du vendeur et du client. Ensuite, plus aucune modification possible.
 */
export async function issueDocument(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d || d.docType === "quote") return { ok: false, error: "Document introuvable." };
  if (d.status !== "draft") return { ok: false, error: "Ce document est déjà émis." };
  const seller = await getSellerSettings(ctx.business.id);
  const miss = settingsMissing(seller);
  if (!seller.saved || miss.length) return { ok: false, error: `Complétez d'abord ${miss.length ? miss.join(", ") : "vos informations de facturation"} dans Réglages de facturation.` };
  const customer = await ownCustomer(ctx.business.id, d.customerId);
  if (!customer) return { ok: false, error: "Choisissez un client." };
  const cm = clientMissing(billingOf(customer));
  if (cm.length) return { ok: false, error: `Fiche client incomplète : ajoutez ${cm.join(", ")}.` };
  const lines = cleanLines(d.lines);
  if (!lines.some((l) => l.desc.trim())) return { ok: false, error: "Ajoutez au moins une prestation avec une description." };
  if (lines.some((l) => l.desc.trim() && num(l.qty) <= 0)) return { ok: false, error: "Chaque ligne doit avoir une quantité supérieure à 0." };
  if (d.docType === "invoice" && d.dueDate && d.dueDate < d.issueDate) return { ok: false, error: "L'échéance ne peut pas être avant la date d'émission." };
  const t = totals(lines, seller.vatRegime);
  if (t.ht === 0) return { ok: false, error: "Le montant total est de 0 €. Vérifiez les prix." };
  if (t.ht < 0) return { ok: false, error: "Le total est négatif : pour rembourser, faites une note de crédit sur la facture." };
  const year = Number(d.issueDate.slice(0, 4));
  const type = d.docType as Exclude<DocType, "quote">;

  const res = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.business.id + ":" + type + ":" + year}))`);
    const [last] = await tx
      .select({ seq: salesDocuments.seq, number: salesDocuments.number, issueDate: salesDocuments.issueDate })
      .from(salesDocuments)
      .where(and(eq(salesDocuments.businessId, ctx.business.id), eq(salesDocuments.docType, type), eq(salesDocuments.year, year), isNotNull(salesDocuments.seq)))
      .orderBy(desc(salesDocuments.seq))
      .limit(1);
    if (last && last.issueDate > d.issueDate) return { error: `La date ne peut pas être antérieure à celle de ${last.number} (${last.issueDate.split("-").reverse().join("/")}). La numérotation doit rester chronologique.` };
    const seq = (last?.seq ?? 0) + 1;
    const number = formatNumber(type, year, seq, seller.prefix);
    const done = await tx
      .update(salesDocuments)
      .set({
        status: "sent",
        year,
        seq,
        number,
        comm: type === "invoice" ? structComm(year, seq, type) : null,
        seller: sellerSnapshot(seller),
        client: clientSnapshot(customer),
        lines,
        htCents: Math.round(t.ht * 100),
        vatCents: Math.round(t.tva * 100),
        ttcCents: Math.round(t.ttc * 100),
        dueDate: type === "credit" ? null : d.dueDate,
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(salesDocuments.id, d.id), eq(salesDocuments.status, "draft")))
      .returning({ id: salesDocuments.id });
    // Déjà émis entre-temps (double clic, deux onglets) : on n'utilise pas ce numéro.
    if (!done.length) return { error: "Ce document vient d'être émis." };
    // Note de crédit qui couvre tout le montant de la facture d'origine : la facture passe en « annulée ».
    if (type === "credit" && d.relatedId) {
      const [inv] = await tx.select().from(salesDocuments).where(and(eq(salesDocuments.businessId, ctx.business.id), eq(salesDocuments.id, d.relatedId)));
      if (inv && inv.docType === "invoice" && inv.status !== "cancelled") {
        const [cr] = await tx.select({ s: sql<number>`coalesce(sum(${salesDocuments.ttcCents}), 0)::int` }).from(salesDocuments).where(and(eq(salesDocuments.relatedId, inv.id), eq(salesDocuments.docType, "credit"), isNotNull(salesDocuments.seq)));
        if ((cr?.s ?? 0) >= inv.ttcCents) await tx.update(salesDocuments).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(salesDocuments.id, inv.id));
      }
    }
    return { number };
  });
  if ("error" in res) return { ok: false, error: res.error! };
  await log(ctx, "invoice.issue", `${type === "credit" ? "Note de crédit" : "Facture"} émise : ${res.number} (${money(t.ttc)})`);
  refresh();
  return { ok: true, id: d.id, message: `${type === "credit" ? "Note de crédit" : "Facture"} ${res.number} émise.` };
}

export async function markPaid(id: string, input: { date: string; method: string }): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d || d.docType !== "invoice" || d.status !== "sent") return { ok: false, error: "Seule une facture émise et non payée peut être encaissée." };
  const date = isoDate.safeParse(input.date);
  if (!date.success) return { ok: false, error: "Date de paiement invalide." };
  await db.update(salesDocuments).set({ status: "paid", paidDate: date.data, paidMethod: String(input.method || "Virement").slice(0, 30), updatedAt: new Date() }).where(eq(salesDocuments.id, d.id));
  await log(ctx, "invoice.paid", `Facture payée : ${d.number}`);
  refresh();
  return { ok: true, message: `Facture ${d.number} marquée comme payée.` };
}

export async function unmarkPaid(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d || d.status !== "paid") return { ok: false, error: "Cette facture n'est pas marquée comme payée." };
  await db.update(salesDocuments).set({ status: "sent", paidDate: null, paidMethod: null, updatedAt: new Date() }).where(eq(salesDocuments.id, d.id));
  await log(ctx, "invoice.unpaid", `Encaissement annulé : ${d.number}`);
  refresh();
  return { ok: true, message: "Encaissement annulé." };
}

/** Prépare une note de crédit (brouillon) qui reprend les lignes de la facture : à ajuster si l'annulation est partielle. */
export async function createCreditNote(invoiceId: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, invoiceId);
  if (!d || d.docType !== "invoice" || !d.number || d.status === "cancelled") return { ok: false, error: "Une note de crédit ne peut être faite que sur une facture émise." };
  const [row] = await db
    .insert(salesDocuments)
    .values({ businessId: ctx.business.id, docType: "credit", status: "draft", customerId: d.customerId, issueDate: todayIso(ctx.business.timezone), notes: "", lines: d.lines, htCents: d.htCents, vatCents: d.vatCents, ttcCents: d.ttcCents, relatedId: d.id, createdById: ctx.user.id })
    .returning({ id: salesDocuments.id });
  await log(ctx, "invoice.credit", `Note de crédit préparée pour ${d.number}`);
  refresh();
  return { ok: true, id: row!.id };
}

/** Nouveau brouillon à partir d'un document existant (une note de crédit redevient une facture). */
export async function duplicateDocument(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d) return { ok: false, error: "Document introuvable." };
  const type = d.docType === "quote" ? "quote" : "invoice";
  const today = todayIso(ctx.business.timezone);
  const r = await saveDocument({ docType: type, customerId: d.customerId, issueDate: today, notes: d.notes, lines: d.lines.map((l) => ({ ...l, id: newLine().id })) });
  return r;
}

export async function setQuoteStatus(id: string, status: "sent" | "accepted" | "refused"): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d || d.docType !== "quote" || d.status === "invoiced") return { ok: false, error: "Devis introuvable ou déjà facturé." };
  if (!["sent", "accepted", "refused"].includes(status)) return { ok: false, error: "Statut invalide." };
  await db.update(salesDocuments).set({ status, updatedAt: new Date() }).where(eq(salesDocuments.id, d.id));
  await log(ctx, "invoice.quote-status", `Devis ${d.number} : ${status === "sent" ? "envoyé" : status === "accepted" ? "accepté" : "refusé"}`);
  refresh();
  return { ok: true, message: status === "accepted" ? "Devis accepté. Vous pouvez le transformer en facture." : "Statut mis à jour." };
}

/** Devis accepté → brouillon de facture avec les mêmes lignes ; le devis passe en « facturé ». */
export async function quoteToInvoice(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d || d.docType !== "quote") return { ok: false, error: "Devis introuvable." };
  // Verrou par devis : deux clics ne créent jamais deux factures.
  const r = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`quote:${d.id}`}))`);
    const [cur] = await tx.select({ status: salesDocuments.status, relatedId: salesDocuments.relatedId }).from(salesDocuments).where(eq(salesDocuments.id, d.id));
    if (cur?.status === "invoiced" && cur.relatedId) return { ok: true as const, id: cur.relatedId, existing: true };
    const created = await saveDocument({ docType: "invoice", customerId: d.customerId, issueDate: todayIso(ctx.business.timezone), notes: d.notes, lines: d.lines });
    if (!created.ok || !created.id) return created;
    await tx.update(salesDocuments).set({ status: "invoiced", relatedId: created.id, updatedAt: new Date() }).where(eq(salesDocuments.id, d.id));
    return created;
  });
  if (!r.ok || !r.id) return r;
  if ("existing" in r) return { ok: true, id: r.id };
  await log(ctx, "invoice.from-quote", `Devis ${d.number} transformé en facture`);
  refresh();
  return { ok: true, id: r.id, message: "Brouillon de facture créé à partir du devis." };
}

/** Seuls les brouillons et les devis non facturés se suppriment (une facture émise reste, la loi l'exige). */
export async function deleteDocument(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const d = await getDocument(ctx.business.id, id);
  if (!d) return { ok: false, error: "Document introuvable." };
  const deletable = d.docType === "quote" ? d.status !== "invoiced" : d.status === "draft";
  if (!deletable) return { ok: false, error: "Un document émis ne peut pas être supprimé : faites une note de crédit." };
  if (d.docType === "quote" && (await signedSignature(d.id))) return { ok: false, error: "Un devis signé par le client est conservé comme preuve : il ne peut pas être supprimé." };
  await db.delete(salesDocuments).where(eq(salesDocuments.id, d.id));
  await log(ctx, "invoice.delete", d.docType === "quote" ? `Devis supprimé : ${d.number}` : "Brouillon supprimé");
  refresh();
  return { ok: true, message: "Supprimé." };
}

/* ───────── Catalogue ───────── */

const productSchema = z.object({ name: z.string().trim().min(1, "Indiquez un nom.").max(200), unit: z.string().max(30), price: z.coerce.number().min(0).max(10_000_000), vat: z.coerce.number().refine((v) => [0, 6, 12, 21].includes(v)) });

export async function saveProduct(id: string | null, input: { name: string; unit: string; price: number | string; vat: number | string }): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const p = productSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Vérifiez les champs." };
  const values = { name: p.data.name, unit: p.data.unit || "forfait", priceCents: Math.round(p.data.price * 100), vatRate: p.data.vat, updatedAt: new Date() };
  if (id) {
    const ok = uuid.safeParse(id);
    if (!ok.success) return { ok: false, error: "Élément introuvable." };
    await db.update(invoiceProducts).set(values).where(and(eq(invoiceProducts.id, ok.data), eq(invoiceProducts.businessId, ctx.business.id)));
  } else await db.insert(invoiceProducts).values({ businessId: ctx.business.id, ...values });
  refresh();
  return { ok: true, message: "Enregistré." };
}

export async function deleteProduct(id: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const ok = uuid.safeParse(id);
  if (!ok.success) return { ok: false, error: "Élément introuvable." };
  await db.delete(invoiceProducts).where(and(eq(invoiceProducts.id, ok.data), eq(invoiceProducts.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Supprimé du catalogue." };
}

/* ───────── Réglages de facturation ───────── */

const settingsSchema = z.object({
  legalName: z.string().trim().max(200),
  tradeName: z.string().trim().max(200),
  legalForm: z.string().trim().max(80),
  street: z.string().trim().max(200),
  zip: z.string().trim().max(20),
  city: z.string().trim().max(100),
  country: z.string().trim().max(80),
  bce: z.string().trim().max(20),
  vatNumber: z.string().trim().max(30),
  email: z.union([z.literal(""), z.email("Email invalide.")]),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(200),
  iban: z.string().trim().max(40),
  bic: z.string().trim().max(15),
  vatRegime: z.enum(["franchise", "assujetti"]),
  paymentDays: z.coerce.number().int().min(0).max(120),
  prefix: z.string().trim().max(10).regex(/^[A-Za-z0-9]*$/, "Lettres et chiffres uniquement."),
  defaultNotes: z.string().max(500),
  footerNote: z.string().max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function saveInvoiceSettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const p = settingsSchema.safeParse(input);
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: fe };
  }
  const v = p.data;
  const fe: Record<string, string> = {};
  if (v.bce && !bceValid(v.bce)) fe.bce = "Numéro d'entreprise invalide (10 chiffres, ex. 1044.474.917).";
  if (v.iban && !ibanValid(v.iban)) fe.iban = "IBAN invalide.";
  if (v.vatRegime === "assujetti" && !v.vatNumber) fe.vatNumber = "Indiquez votre numéro de TVA.";
  if (Object.keys(fe).length) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: fe };
  const values = { ...v, iban: v.iban.replace(/\s+/g, "").toUpperCase(), bic: v.bic.replace(/\s+/g, "").toUpperCase(), prefix: v.prefix.toUpperCase(), updatedAt: new Date() };
  await db.insert(invoiceSettings).values({ businessId: ctx.business.id, ...values }).onConflictDoUpdate({ target: invoiceSettings.businessId, set: values });
  await log(ctx, "invoice.settings", "Réglages de facturation modifiés");
  refresh();
  return { ok: true, message: "Réglages de facturation enregistrés." };
}

/* ───────── Clients (coordonnées de facturation, fiche partagée avec RDV) ───────── */

const clientSchema = z.object({
  name: z.string().trim().min(1, "Indiquez un nom.").max(120),
  company: z.string().trim().max(200),
  email: z.union([z.literal(""), z.email("Email invalide.")]),
  phone: z.string().trim().max(40),
  vatNumber: z.string().trim().max(30),
  street: z.string().trim().max(200),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().max(100),
  country: z.string().trim().max(80),
});

/** Crée (ou complète) une fiche client depuis l'app Factures : elle est aussitôt visible dans Clients et RDV. */
export async function saveBillingClient(id: string | null, input: z.input<typeof clientSchema>): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const p = clientSchema.safeParse(input);
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: fe };
  }
  const v = p.data;
  const billing = { companyName: v.company || null, vatNumber: v.vatNumber || null, street: v.street || null, postalCode: v.postalCode || null, city: v.city || null, country: v.country || null };
  try {
    if (id) {
      const c = await ownCustomer(ctx.business.id, id);
      if (!c) return { ok: false, error: "Client introuvable." };
      await db.update(customers).set({ fullName: v.name, email: v.email.toLowerCase() || null, phone: v.phone || null, ...billing, updatedAt: new Date() }).where(eq(customers.id, c.id));
      refresh();
      return { ok: true, id: c.id, message: "Client mis à jour." };
    }
    const [first, ...rest] = v.name.split(" ");
    const [c] = await db
      .insert(customers)
      .values({ businessId: ctx.business.id, fullName: v.name, firstName: first || null, lastName: rest.join(" ") || null, email: v.email.toLowerCase() || null, phone: v.phone || null, createdManually: true, ...billing })
      .returning({ id: customers.id });
    await log(ctx, "customer.create", `Fiche créée depuis Factures : ${v.name}`);
    refresh();
    return { ok: true, id: c!.id, message: "Client ajouté." };
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err.code === "23505" || err.cause?.code === "23505") return { ok: false, error: "Un client utilise déjà cet email.", fieldErrors: { email: "Un client utilise déjà cet email." } };
    throw e;
  }
}

const billingSchema = clientSchema.pick({ company: true, vatNumber: true, street: true, postalCode: true, city: true, country: true });

/** Coordonnées de facturation d'une fiche client (société, TVA, adresse), sans toucher au nom ni aux contacts. */
export async function saveCustomerBilling(customerId: string, input: z.input<typeof billingSchema>): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const c = await ownCustomer(ctx.business.id, uuid.safeParse(customerId).success ? customerId : null);
  if (!c) return { ok: false, error: "Client introuvable." };
  const p = billingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Vérifiez les champs indiqués." };
  const v = p.data;
  await db.update(customers).set({ companyName: v.company || null, vatNumber: v.vatNumber || null, street: v.street || null, postalCode: v.postalCode || null, city: v.city || null, country: v.country || null, updatedAt: new Date() }).where(eq(customers.id, c.id));
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: "Coordonnées de facturation enregistrées." };
}
