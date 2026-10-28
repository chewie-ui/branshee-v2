"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, members, quoteSignatures, salesDocuments, users } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { getDocument } from "@/server/invoicing";
import { docHash, newSignToken, signatureByToken, signOrigin } from "@/server/signatures";

type Result = { ok: true; message?: string; url?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Envoyer le devis au client pour signature en ligne (le lien précédent, s'il y en a un, est annulé). */
export async function requestSignature(documentId: string, email: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage");
  if (ctx.impersonating) return SUPERVISION;
  const e = z.email().safeParse(email.trim().toLowerCase());
  if (!e.success) return { ok: false, error: "Adresse email invalide." };
  const d = await getDocument(ctx.business.id, documentId);
  if (!d || d.docType !== "quote") return { ok: false, error: "Devis introuvable." };
  if (d.status === "invoiced" || d.status === "refused") return { ok: false, error: "Ce devis est déjà facturé ou refusé." };
  if (!d.client || !d.seller) return { ok: false, error: "Enregistrez d'abord le devis avec un client." };
  const [already] = await db.select({ id: quoteSignatures.id }).from(quoteSignatures).where(and(eq(quoteSignatures.documentId, d.id), sql`${quoteSignatures.signedAt} is not null`, isNull(quoteSignatures.cancelledAt)));
  if (already) return { ok: false, error: "Ce devis est déjà signé." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(quoteSignatures).where(and(eq(quoteSignatures.businessId, ctx.business.id), gte(quoteSignatures.sentAt, new Date(Date.now() - 86400_000))));
  if (n >= 50) return { ok: false, error: "50 demandes de signature en 24 heures : réessayez demain." };
  const token = newSignToken();
  const expires = new Date(Date.now() + 30 * 86400_000);
  await db.transaction(async (tx) => {
    await tx.update(quoteSignatures).set({ cancelledAt: new Date() }).where(and(eq(quoteSignatures.documentId, d.id), isNull(quoteSignatures.signedAt), isNull(quoteSignatures.cancelledAt)));
    await tx.insert(quoteSignatures).values({ businessId: ctx.business.id, documentId: d.id, token, email: e.data, docHash: docHash(d), expiresAt: expires });
    if (d.status === "draft") await tx.update(salesDocuments).set({ status: "sent", updatedAt: new Date() }).where(eq(salesDocuments.id, d.id));
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "quote.sign-request", description: `Devis ${d.number} envoyé pour signature` });
  });
  const seller = String(d.seller.tradeName || d.seller.legalName || ctx.business.name);
  const sent = await sendEmail({ to: e.data, ...emails.signRequest({ sellerName: seller, number: d.number ?? "", amount: eur(d.ttcCents), url: `${signOrigin()}/signer/${token}`, validUntil: d.validUntil }), template: "sign_request", businessId: ctx.business.id, replyTo: String(d.seller.email || "") || null });
  revalidatePath(`/app/factures/${d.id}`);
  return sent ? { ok: true, message: `Devis envoyé à ${e.data} pour signature.`, url: `${signOrigin()}/signer/${token}` } : { ok: false, error: "L'email n'a pas pu partir. Le lien reste utilisable : copiez-le." };
}

export async function cancelSignature(documentId: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage");
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(documentId).success) return { ok: false, error: "Devis introuvable." };
  await db.update(quoteSignatures).set({ cancelledAt: new Date() }).where(and(eq(quoteSignatures.businessId, ctx.business.id), eq(quoteSignatures.documentId, documentId), isNull(quoteSignatures.signedAt), isNull(quoteSignatures.cancelledAt)));
  revalidatePath(`/app/factures/${documentId}`);
  return { ok: true, message: "Lien de signature annulé." };
}

/** Lien utilisable ? (pas annulé, pas expiré, devis inchangé et pas facturé). */
async function usable(token: string) {
  const r = await signatureByToken(token);
  if (!r || r.sig.cancelledAt) return { r: null, error: "Ce lien n'est plus valable. Demandez un nouveau lien à votre fournisseur." };
  if (r.sig.signedAt) return { r, error: "Ce devis est déjà signé." };
  if (r.sig.declinedAt) return { r, error: "Ce devis a été refusé." };
  if (r.sig.expiresAt < new Date()) return { r, error: "Ce lien a expiré. Demandez un nouveau lien à votre fournisseur." };
  if (r.doc.status === "invoiced" || r.doc.status === "refused" || docHash(r.doc) !== r.sig.docHash) return { r, error: "Le devis a été modifié depuis l'envoi. Demandez un nouveau lien à votre fournisseur." };
  return { r, error: null };
}

async function notifyOwner(businessId: string, mail: { subject: string; html: string; text: string }, template: string) {
  const [owner] = await db.select({ email: users.email }).from(members).innerJoin(users, eq(users.id, members.userId)).where(and(eq(members.businessId, businessId), eq(members.isOwner, true)));
  if (owner) await sendEmail({ to: owner.email, ...mail, template, businessId }).catch(() => {});
}

const signSchema = z.object({
  token: z.string().regex(/^[\w-]{20,40}$/),
  name: z.string().trim().min(2, "Écrivez votre nom complet.").max(120),
  path: z.string().max(40_000).regex(/^[ML0-9 .-]+$/, "Signature invalide.").refine((p) => (p.match(/L/g) ?? []).length >= 5, "Tracez votre signature dans le cadre."),
  agree: z.literal(true, { message: "Cochez « Bon pour accord »." }),
});

/** Signature du client (page publique) : nom, tracé, date, IP et empreinte du devis. Le devis passe en « accepté ». */
export async function signQuote(input: z.input<typeof signSchema>): Promise<Result> {
  const v = signSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Signature invalide." };
  const h = await headers();
  const ip = clientIp(h) ?? "inconnue";
  if (!rateLimit(`sign:${ip}`, 10, 3600_000).ok) return { ok: false, error: "Trop d'essais. Réessayez plus tard." };
  const { r, error } = await usable(v.data.token);
  if (error || !r) return { ok: false, error: error ?? "Lien invalide." };
  const done = await db.transaction(async (tx) => {
    const upd = await tx.update(quoteSignatures).set({ signedAt: new Date(), signerName: v.data.name, signerIp: ip, signerAgent: (h.get("user-agent") ?? "").slice(0, 300), signaturePath: v.data.path }).where(and(eq(quoteSignatures.id, r.sig.id), isNull(quoteSignatures.signedAt), isNull(quoteSignatures.cancelledAt), isNull(quoteSignatures.declinedAt))).returning({ id: quoteSignatures.id });
    if (!upd.length) return false;
    await tx.update(salesDocuments).set({ status: "accepted", updatedAt: new Date() }).where(and(eq(salesDocuments.id, r.doc.id), sql`${salesDocuments.status} in ('draft','sent','accepted')`));
    await tx.insert(activityLogs).values({ businessId: r.business.id, actorName: v.data.name, action: "quote.signed", description: `Devis ${r.doc.number} signé en ligne par ${v.data.name}` });
    return true;
  });
  if (!done) return { ok: false, error: "Ce devis est déjà signé." };
  const seller = String(r.doc.seller?.tradeName || r.doc.seller?.legalName || r.business.name);
  await notifyOwner(r.business.id, emails.quoteSigned({ number: r.doc.number ?? "", signer: v.data.name, amount: eur(r.doc.ttcCents), url: `${signOrigin()}/app/factures/${r.doc.id}`, businessName: r.business.name }), "quote_signed");
  await sendEmail({ to: r.sig.email, ...emails.signConfirm({ sellerName: seller, number: r.doc.number ?? "", url: `${signOrigin()}/signer/${v.data.token}` }), template: "sign_confirm", businessId: r.business.id }).catch(() => {});
  return { ok: true, message: "Merci, le devis est signé. Une copie vous est envoyée par email." };
}

const declineSchema = z.object({ token: z.string().regex(/^[\w-]{20,40}$/), reason: z.string().trim().max(500) });

export async function declineQuote(input: z.input<typeof declineSchema>): Promise<Result> {
  const v = declineSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Message invalide." };
  const ip = clientIp(await headers()) ?? "inconnue";
  if (!rateLimit(`sign:${ip}`, 10, 3600_000).ok) return { ok: false, error: "Trop d'essais. Réessayez plus tard." };
  const { r, error } = await usable(v.data.token);
  if (error || !r) return { ok: false, error: error ?? "Lien invalide." };
  const upd = await db.update(quoteSignatures).set({ declinedAt: new Date(), declineReason: v.data.reason || null }).where(and(eq(quoteSignatures.id, r.sig.id), isNull(quoteSignatures.signedAt), isNull(quoteSignatures.declinedAt))).returning({ id: quoteSignatures.id });
  if (!upd.length) return { ok: false, error: "Ce devis a déjà reçu une réponse." };
  await notifyOwner(r.business.id, emails.quoteDeclined({ number: r.doc.number ?? "", reason: v.data.reason || null, url: `${signOrigin()}/app/factures/${r.doc.id}`, businessName: r.business.name }), "quote_declined");
  return { ok: true, message: "Votre réponse a été transmise. Merci." };
}
