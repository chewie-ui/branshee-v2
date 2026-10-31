import "server-only";
import { headers } from "next/headers";
import { and, desc, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { quoteSignatures, salesDocuments } from "@/db/schema";
import { cancelSignature, requestSignature } from "@/server/actions/signatures";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { signOrigin, signaturesOfDoc } from "@/server/signatures";

/** API mobile de l'app Signature (Skydev) : demandes de signature des devis, envoi, annulation. */

async function needSignature(permission: "invoices.view" | "invoices.manage" = "invoices.view"): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("signature") || !ctx.can(permission)) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
type Sig = typeof quoteSignatures.$inferSelect;
const state = (s: Sig, now = new Date()) => (s.signedAt ? "signed" : s.declinedAt ? "declined" : s.cancelledAt ? "cancelled" : s.expiresAt < now ? "expired" : s.viewedAt ? "viewed" : "sent");
const dto = (s: Sig) => ({
  id: s.id,
  documentId: s.documentId,
  email: s.email,
  state: state(s),
  sentAt: s.sentAt.toISOString(),
  expiresAt: s.expiresAt.toISOString(),
  viewedAt: s.viewedAt?.toISOString() ?? null,
  signedAt: s.signedAt?.toISOString() ?? null,
  signerName: s.signerName,
  declinedAt: s.declinedAt?.toISOString() ?? null,
  declineReason: s.declineReason,
  url: !s.signedAt && !s.cancelledAt && !s.declinedAt ? `${signOrigin()}/signer/${s.token}` : null,
});

async function list() {
  const ctx = await needSignature();
  const rows = await db
    .select({ s: quoteSignatures, number: salesDocuments.number, total: salesDocuments.ttcCents, client: salesDocuments.client })
    .from(quoteSignatures)
    .innerJoin(salesDocuments, eq(salesDocuments.id, quoteSignatures.documentId))
    .where(and(eq(quoteSignatures.businessId, ctx.business.id), isNull(quoteSignatures.cancelledAt)))
    .orderBy(desc(quoteSignatures.sentAt))
    .limit(300);
  return { canManage: ctx.can("invoices.manage"), signatures: rows.map(({ s, number, total, client }) => ({ ...dto(s), number, totalCents: total, client: String(client?.name ?? s.email) })) };
}

/** Devis qu'on peut envoyer pour signature (pas facturés ni refusés), avec l'email du client pour pré-remplir. */
async function quotes() {
  const ctx = await needSignature("invoices.manage");
  const rows = await db
    .select({ id: salesDocuments.id, number: salesDocuments.number, status: salesDocuments.status, client: salesDocuments.client, ttc: salesDocuments.ttcCents, issueDate: salesDocuments.issueDate, validUntil: salesDocuments.validUntil })
    .from(salesDocuments)
    .where(and(eq(salesDocuments.businessId, ctx.business.id), eq(salesDocuments.docType, "quote"), notInArray(salesDocuments.status, ["invoiced", "refused"])))
    .orderBy(desc(salesDocuments.issueDate))
    .limit(200);
  return { quotes: rows.map((q) => ({ id: q.id, number: q.number, status: q.status, client: String(q.client?.name ?? ""), email: String(q.client?.email ?? ""), totalCents: q.ttc, issueDate: q.issueDate, validUntil: q.validUntil })) };
}

async function ofDoc(r: ApiRequest) {
  const ctx = await needSignature();
  if (!uuid(r.params.id)) return fail(404, "not_found", "Devis introuvable.");
  return { signatures: (await signaturesOfDoc(ctx.business.id, r.params.id!)).map(dto) };
}

export const signatureRoutes: Route[] = [
  { method: "GET", path: "/signatures", handler: list },
  { method: "GET", path: "/signatures/quotes", handler: quotes },
  { method: "GET", path: "/signatures/doc/:id", handler: ofDoc },
  {
    method: "POST",
    path: "/signatures",
    handler: async (r) => {
      await needSignature("invoices.manage");
      if (!uuid(r.body.documentId)) return fail(404, "not_found", "Devis introuvable.");
      const res = await requestSignature(r.body.documentId as string, str(r.body.email, 200));
      if (!res.ok) return invalid(res.error);
      return { ok: true, message: res.message, url: res.url ?? null };
    },
  },
  {
    method: "POST",
    path: "/signatures/doc/:id/cancel",
    handler: async (r) => {
      await needSignature("invoices.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Devis introuvable.");
      const res = await cancelSignature(r.params.id!);
      if (!res.ok) return invalid(res.error);
      return { ok: true };
    },
  },
];
