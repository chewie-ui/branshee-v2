import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { businesses, customers, invoiceProducts, invoiceSettings, salesDocuments, services } from "@/db/schema";
import { epcPayload, type DocType, type SellerSettings } from "@/lib/invoicing";

export type SalesDoc = typeof salesDocuments.$inferSelect;
export type CustomerOption = { id: string; name: string; company: string | null; email: string | null; phone: string | null; vatNumber: string | null; street: string | null; postalCode: string | null; city: string | null; country: string | null };

/** Identité de facturation : la fiche enregistrée, sinon une proposition pré-remplie depuis l'établissement. */
export async function getSellerSettings(businessId: string): Promise<SellerSettings & { saved: boolean }> {
  const [row] = await db.select().from(invoiceSettings).where(eq(invoiceSettings.businessId, businessId));
  if (row) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { businessId: _b, createdAt: _c, updatedAt: _u, ...rest } = row;
    return { ...rest, saved: true };
  }
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  return {
    saved: false,
    legalName: "",
    tradeName: b?.name ?? "",
    legalForm: "Personne physique",
    street: b?.address ?? "",
    zip: b?.postalCode ?? "",
    city: b?.city ?? "",
    country: b?.country && b.country !== "BE" ? b.country : "Belgique",
    bce: "",
    vatNumber: "",
    email: b?.email ?? "",
    phone: b?.phone ?? "",
    website: b?.website ?? "",
    iban: "",
    bic: "",
    vatRegime: "franchise",
    paymentDays: 15,
    prefix: "",
    defaultNotes: "Merci pour votre confiance.",
    footerNote: "",
    color: "#4f46e5",
  };
}

export async function listDocuments(businessId: string, types: DocType[]) {
  return db
    .select()
    .from(salesDocuments)
    .where(and(eq(salesDocuments.businessId, businessId), inArray(salesDocuments.docType, types)))
    .orderBy(desc(salesDocuments.issueDate), desc(salesDocuments.createdAt))
    .limit(500);
}

export async function getDocument(businessId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [d] = await db.select().from(salesDocuments).where(and(eq(salesDocuments.businessId, businessId), eq(salesDocuments.id, id)));
  return d ?? null;
}

/** Documents liés : facture d'origine d'une note de crédit, notes de crédit d'une facture, facture née d'un devis. */
export async function relatedDocuments(businessId: string, d: SalesDoc) {
  const ids = [d.relatedId].filter((x): x is string => !!x);
  const [linked, children] = await Promise.all([
    ids.length ? db.select({ id: salesDocuments.id, number: salesDocuments.number, docType: salesDocuments.docType, issueDate: salesDocuments.issueDate }).from(salesDocuments).where(and(eq(salesDocuments.businessId, businessId), inArray(salesDocuments.id, ids))) : Promise.resolve([]),
    db.select({ id: salesDocuments.id, number: salesDocuments.number, docType: salesDocuments.docType, issueDate: salesDocuments.issueDate }).from(salesDocuments).where(and(eq(salesDocuments.businessId, businessId), eq(salesDocuments.relatedId, d.id))),
  ]);
  return { linked: linked[0] ?? null, children };
}

export async function customerOptions(businessId: string): Promise<CustomerOption[]> {
  const rows = await db
    .select({ id: customers.id, name: customers.fullName, company: customers.companyName, email: customers.email, phone: customers.phone, vatNumber: customers.vatNumber, street: customers.street, postalCode: customers.postalCode, city: customers.city, country: customers.country })
    .from(customers)
    .where(and(eq(customers.businessId, businessId), sql`${customers.blockedAt} is null`))
    .orderBy(asc(customers.fullName))
    .limit(2000);
  return rows;
}

/** Catalogue : produits enregistrés + prestations RDV avec un prix (l'avantage du tout-en-un). */
export async function catalog(businessId: string) {
  const [products, svc] = await Promise.all([
    db.select().from(invoiceProducts).where(eq(invoiceProducts.businessId, businessId)).orderBy(asc(invoiceProducts.name)),
    db.select({ id: services.id, name: services.name, priceCents: services.priceCents }).from(services).where(and(eq(services.businessId, businessId), isNotNull(services.priceCents))).orderBy(asc(services.name)),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, price: p.priceCents / 100, vat: p.vatRate, source: "catalogue" as const })),
    services: svc.filter((s) => (s.priceCents ?? 0) > 0).map((s) => ({ id: s.id, name: s.name, unit: "séance", price: (s.priceCents ?? 0) / 100, vat: 21, source: "prestation" as const })),
  };
}

/** QR de paiement (data URL) d'une facture émise, ou null si pas d'IBAN valide. */
export async function paymentQr(d: SalesDoc) {
  if (d.docType !== "invoice" || d.status === "draft" || !d.seller) return null;
  const payload = epcPayload(d.seller, d.ttcCents / 100, d.comm ?? d.number ?? "");
  return payload ? QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, width: 220 }) : null;
}

/** Chiffres du tableau de bord pour une année : CA (hors TVA, notes de crédit déduites), encaissé, à encaisser. */
export async function dashboardStats(businessId: string, year: number, today: string) {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const issued = await db
    .select({ docType: salesDocuments.docType, status: salesDocuments.status, issueDate: salesDocuments.issueDate, dueDate: salesDocuments.dueDate, paidDate: salesDocuments.paidDate, ht: salesDocuments.htCents, ttc: salesDocuments.ttcCents })
    .from(salesDocuments)
    .where(and(eq(salesDocuments.businessId, businessId), inArray(salesDocuments.docType, ["invoice", "credit"]), isNotNull(salesDocuments.number), gte(salesDocuments.issueDate, from), lt(salesDocuments.issueDate, to)));
  const months = Array(12).fill(0) as number[];
  let revenue = 0;
  let count = 0;
  for (const d of issued) {
    const sign = d.docType === "credit" ? -1 : 1;
    revenue += sign * d.ht;
    months[Number(d.issueDate.slice(5, 7)) - 1]! += sign * d.ht;
    if (d.docType === "invoice") count++;
  }
  const [paid] = await db
    .select({ n: sql<number>`coalesce(sum(${salesDocuments.ttcCents}), 0)::int`, c: sql<number>`count(*)::int` })
    .from(salesDocuments)
    .where(and(eq(salesDocuments.businessId, businessId), eq(salesDocuments.docType, "invoice"), eq(salesDocuments.status, "paid"), gte(salesDocuments.paidDate, from), lt(salesDocuments.paidDate, to)));
  const open = await db
    .select({ id: salesDocuments.id, number: salesDocuments.number, client: salesDocuments.client, dueDate: salesDocuments.dueDate, ttc: salesDocuments.ttcCents })
    .from(salesDocuments)
    .where(and(eq(salesDocuments.businessId, businessId), eq(salesDocuments.docType, "invoice"), eq(salesDocuments.status, "sent")))
    .orderBy(asc(salesDocuments.dueDate));
  return {
    revenueCents: revenue,
    invoiceCount: count,
    monthsCents: months,
    paidCents: paid?.n ?? 0,
    paidCount: paid?.c ?? 0,
    openCents: open.reduce((s, d) => s + d.ttc, 0),
    openCount: open.length,
    overdue: open.filter((d) => d.dueDate && d.dueDate < today),
  };
}
