import "server-only";
import { and, asc, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { dealActivities, deals, members, salesDocuments } from "@/db/schema";
import type { AppContext } from "@/server/context";

/** Voir : qui voit les fiches clients. Modifier : qui gère les fiches clients. */
export const salesRights = (ctx: AppContext) => ({ view: ctx.can("customers.view"), manage: ctx.can("customers.manage") });

export type DealView = {
  id: string; title: string; contactName: string | null; companyName: string | null; email: string | null; phone: string | null;
  valueCents: number; stage: string; source: string | null; ownerMemberId: string | null; customerId: string | null;
  nextActionDate: string | null; nextAction: string | null; expectedClose: string | null; lostReason: string | null; closedAt: string | null; createdAt: string;
};

/** Pistes ouvertes et pistes clôturées des 12 derniers mois. */
export async function listDeals(businessId: string): Promise<DealView[]> {
  const since = new Date(Date.now() - 365 * 86400_000);
  const rows = await db.select().from(deals).where(and(eq(deals.businessId, businessId), or(isNull(deals.closedAt), gte(deals.closedAt, since)))).orderBy(asc(deals.nextActionDate), desc(deals.updatedAt)).limit(2000);
  return rows.map((d) => ({
    id: d.id, title: d.title, contactName: d.contactName, companyName: d.companyName, email: d.email, phone: d.phone, valueCents: d.valueCents, stage: d.stage, source: d.source,
    ownerMemberId: d.ownerMemberId, customerId: d.customerId, nextActionDate: d.nextActionDate, nextAction: d.nextAction, expectedClose: d.expectedClose, lostReason: d.lostReason,
    closedAt: d.closedAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(),
  }));
}

export async function salesMembers(businessId: string) {
  return db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, businessId), eq(members.status, "active"), eq(members.isActive, true))).orderBy(asc(members.displayName));
}

/** Historique d'une piste et documents (devis, factures) du client relié. */
export async function dealDetailFor(businessId: string, dealId: string, withDocs = true) {
  const [d] = await db.select({ id: deals.id, customerId: deals.customerId }).from(deals).where(and(eq(deals.id, dealId), eq(deals.businessId, businessId)));
  if (!d) return null;
  const [acts, docs] = await Promise.all([
    db.select({ id: dealActivities.id, kind: dealActivities.kind, body: dealActivities.body, createdAt: dealActivities.createdAt, by: members.displayName }).from(dealActivities).leftJoin(members, eq(members.id, dealActivities.memberId)).where(and(eq(dealActivities.dealId, d.id), eq(dealActivities.businessId, businessId))).orderBy(desc(dealActivities.createdAt)).limit(200),
    d.customerId && withDocs
      ? db.select({ id: salesDocuments.id, docType: salesDocuments.docType, status: salesDocuments.status, number: salesDocuments.number, ttcCents: salesDocuments.ttcCents, issueDate: salesDocuments.issueDate }).from(salesDocuments).where(and(eq(salesDocuments.businessId, businessId), eq(salesDocuments.customerId, d.customerId))).orderBy(desc(salesDocuments.issueDate)).limit(20)
      : Promise.resolve([]),
  ]);
  return { activities: acts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })), documents: docs };
}
