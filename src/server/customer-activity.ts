import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deals, documents, interventions, loyaltyCards, posSales, projects, reviewRequests, salesDocuments, shopOrders } from "@/db/schema";
import type { AppContext } from "@/server/context";

/** Tout ce qui concerne un client dans les apps Skydev (chaque bloc selon les droits du membre). */
export async function customerActivity(ctx: AppContext, customer: { id: string; email: string | null }) {
  const b = ctx.business.id;
  const finance = ctx.can("invoices.view");
  const email = customer.email?.toLowerCase() ?? null;
  const [docs, dealRows, projectRows, interventionRows, pos, orders, card, reviews, files] = await Promise.all([
    finance ? db.select({ id: salesDocuments.id, docType: salesDocuments.docType, status: salesDocuments.status, number: salesDocuments.number, ttc: salesDocuments.ttcCents, date: salesDocuments.issueDate }).from(salesDocuments).where(and(eq(salesDocuments.businessId, b), eq(salesDocuments.customerId, customer.id))).orderBy(desc(salesDocuments.issueDate)).limit(20) : Promise.resolve([]),
    db.select({ id: deals.id, title: deals.title, stage: deals.stage, value: deals.valueCents }).from(deals).where(and(eq(deals.businessId, b), eq(deals.customerId, customer.id))).orderBy(desc(deals.updatedAt)).limit(10),
    db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects).where(and(eq(projects.businessId, b), eq(projects.customerId, customer.id))).orderBy(desc(projects.updatedAt)).limit(10),
    db.select({ id: interventions.id, number: interventions.number, title: interventions.title, status: interventions.status, at: interventions.scheduledAt }).from(interventions).where(and(eq(interventions.businessId, b), eq(interventions.customerId, customer.id))).orderBy(desc(interventions.scheduledAt)).limit(10),
    finance ? db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${posSales.totalCents}), 0)::int` }).from(posSales).where(and(eq(posSales.businessId, b), eq(posSales.customerId, customer.id), eq(posSales.status, "paid"))) : Promise.resolve([]),
    email && finance ? db.select({ id: shopOrders.id, number: shopOrders.number, status: shopOrders.status, total: shopOrders.totalCents, at: shopOrders.createdAt }).from(shopOrders).where(and(eq(shopOrders.businessId, b), eq(shopOrders.email, email))).orderBy(desc(shopOrders.createdAt)).limit(10) : Promise.resolve([]),
    db.select({ stamps: loyaltyCards.stamps, rewards: loyaltyCards.rewardsEarned }).from(loyaltyCards).where(and(eq(loyaltyCards.businessId, b), eq(loyaltyCards.customerId, customer.id))),
    db.select({ at: reviewRequests.createdAt, clicked: reviewRequests.googleClickedAt, feedback: reviewRequests.feedbackRating }).from(reviewRequests).where(and(eq(reviewRequests.businessId, b), eq(reviewRequests.customerId, customer.id))).orderBy(desc(reviewRequests.createdAt)).limit(5),
    db.select({ id: documents.id, name: documents.name, at: documents.createdAt }).from(documents).where(and(eq(documents.businessId, b), eq(documents.customerId, customer.id))).orderBy(desc(documents.createdAt)).limit(10),
  ]);
  return { finance, docs, deals: dealRows, projects: projectRows, interventions: interventionRows, pos: pos[0] ?? null, orders, card: card[0] ?? null, reviews, files };
}
