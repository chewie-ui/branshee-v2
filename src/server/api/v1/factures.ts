import "server-only";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import type { DocParty } from "@/components/invoicing/invoice-document";
import { db } from "@/db";
import { invoiceMailings } from "@/db/schema";
import { settingsMissing, todayIso, totals, type DocType } from "@/lib/invoicing";
import {
  createCreditNote,
  deleteDocument,
  deleteProduct,
  duplicateDocument,
  issueDocument,
  markPaid,
  quoteToInvoice,
  saveBillingClient,
  saveDocument,
  saveInvoiceSettings,
  saveProduct,
  setQuoteStatus,
  unmarkPaid,
} from "@/server/actions/invoicing";
import { sendInvoiceByEmail, setInvoiceReminders } from "@/server/actions/invoice-mailing";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { invoicePdf, pdfFileName } from "@/server/invoice-pdf";
import { invoiceUrl } from "@/server/invoice-mailing";
import { catalog, customerOptions, dashboardStats, getDocument, getSellerSettings, listDocuments, paymentQr, relatedDocuments, type SalesDoc } from "@/server/invoicing";
import { isLocked } from "@/server/plan";

/**
 * API mobile de l'app Factures (Skydev) : mêmes actions que les pages /app/factures du site.
 * Montants en euros (le site stocke des centimes).
 */

async function needFactures(permission: "invoices.view" | "invoices.manage"): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("factures") || !ctx.can(permission)) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (permission === "invoices.manage" && method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const eur = (c: number | null | undefined) => (c ?? 0) / 100;

/** Résultat d'une action du site → réponse ou erreur lisible par l'application. */
function ok<T extends { ok: boolean }>(r: T): T & { id?: string; message?: string } {
  const e = r as { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
  if (!e.ok) return invalid(e.error ?? "Action impossible.", e.fieldErrors ? { fieldErrors: e.fieldErrors } : {});
  return r as T & { id?: string; message?: string };
}

function docDto(d: SalesDoc, today: string) {
  return {
    id: d.id,
    type: d.docType,
    status: d.status,
    overdue: d.docType === "invoice" && d.status === "sent" && !!d.dueDate && d.dueDate < today,
    number: d.number,
    customerId: d.customerId,
    client: d.client ?? null,
    issueDate: d.issueDate,
    serviceDate: d.serviceDate,
    dueDate: d.dueDate,
    validUntil: d.validUntil,
    comm: d.comm,
    notes: d.notes,
    lines: d.lines,
    ht: eur(d.htCents),
    vat: eur(d.vatCents),
    ttc: eur(d.ttcCents),
    relatedId: d.relatedId,
    paidDate: d.paidDate,
    paidMethod: d.paidMethod,
  };
}

async function list(r: ApiRequest) {
  const ctx = await needFactures("invoices.view");
  const type = r.query.get("type");
  const types: DocType[] = type === "quote" ? ["quote"] : type === "all" ? ["invoice", "credit", "quote"] : ["invoice", "credit"];
  const today = todayIso(ctx.business.timezone);
  const docs = await listDocuments(ctx.business.id, types);
  return { documents: docs.map((d) => docDto(d, today)) };
}

async function detail(r: ApiRequest) {
  const ctx = await needFactures("invoices.view");
  const d = await getDocument(ctx.business.id, r.params.id!);
  if (!d) return fail(404, "not_found", "Document introuvable.");
  const [rel, [m], settings] = await Promise.all([
    relatedDocuments(ctx.business.id, d),
    db.select().from(invoiceMailings).where(and(eq(invoiceMailings.businessId, ctx.business.id), eq(invoiceMailings.documentId, d.id))),
    getSellerSettings(ctx.business.id),
  ]);
  const regime = (d.seller?.vatRegime as "franchise" | "assujetti" | undefined) ?? settings.vatRegime;
  return {
    document: docDto(d, todayIso(ctx.business.timezone)),
    vatRows: totals(d.lines, regime).vatRows,
    vatRegime: regime,
    related: rel.linked,
    children: rel.children,
    mailing: m ? { email: m.email, sentAt: m.sentAt.toISOString(), viewedAt: m.viewedAt?.toISOString() ?? null, remindersSent: m.remindersSent, remindersOff: m.remindersOff, url: invoiceUrl(m.token) } : null,
    canManage: ctx.can("invoices.manage"),
  };
}

async function dashboard(r: ApiRequest) {
  const ctx = await needFactures("invoices.view");
  const today = todayIso(ctx.business.timezone);
  const year = Number(r.query.get("year")) || Number(today.slice(0, 4));
  const s = await dashboardStats(ctx.business.id, year, today);
  const settings = await getSellerSettings(ctx.business.id);
  return {
    year,
    revenue: eur(s.revenueCents),
    invoiceCount: s.invoiceCount,
    months: s.monthsCents.map(eur),
    paid: eur(s.paidCents),
    paidCount: s.paidCount,
    open: eur(s.openCents),
    openCount: s.openCount,
    overdue: s.overdue.map((d) => ({ id: d.id, number: d.number, client: d.client ?? null, dueDate: d.dueDate, ttc: eur(d.ttc) })),
    vatRegime: settings.vatRegime,
    settingsComplete: settings.saved && settingsMissing(settings).length === 0,
  };
}

async function save(r: ApiRequest, id: string | null) {
  const ctx = await needFactures("invoices.manage");
  const b = r.body;
  const type = b.type === "quote" ? "quote" : b.type === "credit" ? "credit" : "invoice";
  const res = ok(
    await saveDocument({
      id: id ?? undefined,
      docType: type,
      customerId: uuid(b.customerId) ? (b.customerId as string) : null,
      issueDate: str(b.issueDate, 10) || todayIso(ctx.business.timezone),
      serviceDate: str(b.serviceDate, 10) || null,
      dueDate: str(b.dueDate, 10) || null,
      validUntil: str(b.validUntil, 10) || null,
      notes: str(b.notes, 2000),
      lines: Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]).slice(0, 200).map((l) => ({ id: str(l.id, 40), desc: str(l.desc, 2000), qty: Number(l.qty) || 0, unit: str(l.unit, 30) || "forfait", price: Number(l.price) || 0, vat: Number(l.vat) || 0 })) : [],
      relatedId: uuid(b.relatedId) ? (b.relatedId as string) : null,
      appointmentId: uuid(b.appointmentId) ? (b.appointmentId as string) : null,
    }),
  );
  const docId = res.id ?? id;
  const d = docId ? await getDocument(ctx.business.id, docId) : null;
  return { document: d ? docDto(d, todayIso(ctx.business.timezone)) : null };
}

/** Action sur un document puis renvoi du document (ou du nouveau document créé). */
function action(fn: (id: string, r: ApiRequest) => Promise<{ ok: boolean }>) {
  return async (r: ApiRequest) => {
    const ctx = await needFactures("invoices.manage");
    if (!uuid(r.params.id)) return fail(404, "not_found", "Document introuvable.");
    const res = ok(await fn(r.params.id!, r));
    const d = await getDocument(ctx.business.id, res.id ?? r.params.id!);
    return { ok: true, message: res.message ?? null, document: d ? docDto(d, todayIso(ctx.business.timezone)) : null };
  };
}

async function pdf(r: ApiRequest) {
  const ctx = await needFactures("invoices.view");
  const d = await getDocument(ctx.business.id, r.params.id!);
  if (!d) return fail(404, "not_found", "Document introuvable.");
  const [settings, customers, rel, qr] = await Promise.all([getSellerSettings(ctx.business.id), customerOptions(ctx.business.id), relatedDocuments(ctx.business.id, d), paymentQr(d)]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { saved: _saved, ...current } = settings;
  const c = customers.find((x) => x.id === d.customerId);
  const client: DocParty | null = d.client ?? (c ? { name: c.company || c.name, contact: c.company ? c.name : "", street: c.street ?? "", zip: c.postalCode ?? "", city: c.city ?? "", country: c.country ?? "", vat: c.vatNumber ?? "" } : null);
  const buf = await invoicePdf({ doc: { ...d, related: rel.linked }, seller: d.seller ?? current, client, qr });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdfFileName(d))}`, "Cache-Control": "private, no-store" } });
}

async function settingsGet() {
  const ctx = await needFactures("invoices.view");
  const s = await getSellerSettings(ctx.business.id);
  return { settings: s, missing: settingsMissing(s) };
}

export const facturesRoutes: Route[] = [
  { method: "GET", path: "/invoices/dashboard", handler: dashboard },
  {
    method: "GET",
    path: "/invoices/catalog",
    handler: async () => {
      const ctx = await needFactures("invoices.view");
      return catalog(ctx.business.id);
    },
  },
  {
    method: "GET",
    path: "/invoices/customers",
    handler: async () => {
      const ctx = await needFactures("invoices.view");
      return { customers: await customerOptions(ctx.business.id) };
    },
  },
  {
    method: "POST",
    path: "/invoices/customers",
    handler: async (r) => {
      const ctx = await needFactures("invoices.manage");
      const b = r.body;
      const res = ok(await saveBillingClient(uuid(b.id) ? (b.id as string) : null, { name: str(b.name, 120), company: str(b.company, 200), email: str(b.email, 200), phone: str(b.phone, 40), vatNumber: str(b.vatNumber, 30), street: str(b.street, 200), postalCode: str(b.postalCode, 20), city: str(b.city, 100), country: str(b.country, 80) }));
      const list = await customerOptions(ctx.business.id);
      return { customer: list.find((c) => c.id === res.id) ?? null, customers: list };
    },
  },
  { method: "GET", path: "/invoices/settings", handler: settingsGet },
  {
    method: "PATCH",
    path: "/invoices/settings",
    handler: async (r) => {
      await needFactures("invoices.manage");
      const cur = (await settingsGet()).settings;
      const b = r.body;
      const pick = (k: keyof typeof cur) => (k in b ? b[k] : cur[k]);
      ok(
        await saveInvoiceSettings({
          legalName: String(pick("legalName") ?? ""), tradeName: String(pick("tradeName") ?? ""), legalForm: String(pick("legalForm") ?? ""), street: String(pick("street") ?? ""), zip: String(pick("zip") ?? ""), city: String(pick("city") ?? ""), country: String(pick("country") ?? ""),
          bce: String(pick("bce") ?? ""), vatNumber: String(pick("vatNumber") ?? ""), email: String(pick("email") ?? ""), phone: String(pick("phone") ?? ""), website: String(pick("website") ?? ""), iban: String(pick("iban") ?? ""), bic: String(pick("bic") ?? ""),
          vatRegime: pick("vatRegime") === "assujetti" ? "assujetti" : "franchise", paymentDays: Number(pick("paymentDays")) || 0, prefix: String(pick("prefix") ?? ""), defaultNotes: String(pick("defaultNotes") ?? ""), footerNote: String(pick("footerNote") ?? ""), color: String(pick("color") ?? "#4f46e5"),
        }),
      );
      return settingsGet();
    },
  },
  {
    method: "POST",
    path: "/invoices/products",
    handler: async (r) => {
      const ctx = await needFactures("invoices.manage");
      ok(await saveProduct(null, { name: str(r.body.name, 200), unit: str(r.body.unit, 30) || "forfait", price: Number(r.body.price) || 0, vat: Number(r.body.vat) || 0 }));
      return catalog(ctx.business.id);
    },
  },
  {
    method: "PATCH",
    path: "/invoices/products/:id",
    handler: async (r) => {
      const ctx = await needFactures("invoices.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Produit introuvable.");
      ok(await saveProduct(r.params.id!, { name: str(r.body.name, 200), unit: str(r.body.unit, 30) || "forfait", price: Number(r.body.price) || 0, vat: Number(r.body.vat) || 0 }));
      return catalog(ctx.business.id);
    },
  },
  {
    method: "DELETE",
    path: "/invoices/products/:id",
    handler: async (r) => {
      const ctx = await needFactures("invoices.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Produit introuvable.");
      ok(await deleteProduct(r.params.id!));
      return catalog(ctx.business.id);
    },
  },

  { method: "GET", path: "/invoices", handler: list },
  { method: "POST", path: "/invoices", handler: (r) => save(r, null) },
  { method: "GET", path: "/invoices/:id", handler: detail },
  { method: "GET", path: "/invoices/:id/pdf", handler: pdf },
  { method: "PATCH", path: "/invoices/:id", handler: (r) => (uuid(r.params.id) ? save(r, r.params.id!) : fail(404, "not_found", "Document introuvable.")) },
  { method: "POST", path: "/invoices/:id/issue", handler: action((id) => issueDocument(id)) },
  { method: "POST", path: "/invoices/:id/paid", handler: action((id, r) => markPaid(id, { date: str(r.body.date, 10), method: str(r.body.method, 40) })) },
  { method: "POST", path: "/invoices/:id/unpaid", handler: action((id) => unmarkPaid(id)) },
  { method: "POST", path: "/invoices/:id/credit-note", handler: action((id) => createCreditNote(id)) },
  { method: "POST", path: "/invoices/:id/duplicate", handler: action((id) => duplicateDocument(id)) },
  { method: "POST", path: "/invoices/:id/quote-status", handler: action((id, r) => setQuoteStatus(id, r.body.status === "accepted" ? "accepted" : r.body.status === "refused" ? "refused" : "sent")) },
  { method: "POST", path: "/invoices/:id/to-invoice", handler: action((id) => quoteToInvoice(id)) },
  { method: "POST", path: "/invoices/:id/send", handler: action((id, r) => sendInvoiceByEmail(id, str(r.body.email, 200))) },
  { method: "POST", path: "/invoices/:id/reminders", handler: action((id, r) => setInvoiceReminders(id, r.body.on === true)) },
  {
    method: "DELETE",
    path: "/invoices/:id",
    handler: async (r) => {
      await needFactures("invoices.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Document introuvable.");
      ok(await deleteDocument(r.params.id!));
      return { ok: true };
    },
  },
];
