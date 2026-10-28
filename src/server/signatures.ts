import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, quoteSignatures, salesDocuments } from "@/db/schema";
import type { SalesDoc } from "@/server/invoicing";

export const newSignToken = () => randomBytes(18).toString("base64url");
export const signOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

/** Empreinte du devis : ce que le client signe (lignes, montants, client, vendeur, dates, conditions). */
export function docHash(d: Pick<SalesDoc, "number" | "lines" | "htCents" | "vatCents" | "ttcCents" | "client" | "seller" | "issueDate" | "validUntil" | "notes">) {
  const payload = JSON.stringify([d.number, d.lines, d.htCents, d.vatCents, d.ttcCents, d.client, d.seller, d.issueDate, d.validUntil, d.notes]);
  return createHash("sha256").update(payload).digest("hex");
}

export async function signaturesOfDoc(businessId: string, documentId: string) {
  return db.select().from(quoteSignatures).where(and(eq(quoteSignatures.businessId, businessId), eq(quoteSignatures.documentId, documentId))).orderBy(desc(quoteSignatures.sentAt)).limit(20);
}

/** Demande publique : devis, établissement. Null si le lien est inconnu ou l'établissement supprimé. */
export async function signatureByToken(token: string) {
  if (!/^[\w-]{20,40}$/.test(token)) return null;
  const [r] = await db
    .select({ sig: quoteSignatures, doc: salesDocuments, business: { id: businesses.id, name: businesses.name } })
    .from(quoteSignatures)
    .innerJoin(salesDocuments, eq(salesDocuments.id, quoteSignatures.documentId))
    .innerJoin(businesses, eq(businesses.id, quoteSignatures.businessId))
    .where(and(eq(quoteSignatures.token, token), isNull(businesses.deletedAt)));
  return r ?? null;
}

export async function signedSignature(documentId: string) {
  const [s] = await db.select().from(quoteSignatures).where(and(eq(quoteSignatures.documentId, documentId), isNull(quoteSignatures.cancelledAt), isNotNull(quoteSignatures.signedAt))).limit(1);
  return s ?? null;
}
