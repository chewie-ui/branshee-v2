import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, campaignRecipients, campaigns, customers, invoiceSettings, type CampaignAudience } from "@/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { effectivePlan } from "@/server/plan";
import type { AppContext } from "@/server/context";

export const marketingRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const mkOrigin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
export const newMkToken = () => randomBytes(16).toString("base64url");

/** Clients de l'audience : email connu, pas bloqués, pas désabonnés ; filtrés par date du dernier RDV si demandé. */
export function audienceWhere(businessId: string, a: CampaignAudience) {
  const last = sql`(select max(ap.starts_at) from appointments ap where ap.customer_id = "customers"."id" and ap.status <> 'cancelled' and ap.starts_at < now())`;
  return and(
    eq(customers.businessId, businessId),
    isNotNull(customers.email),
    isNull(customers.marketingOptOutAt),
    isNull(customers.blockedAt),
    a.type === "recent" ? sql`${last} >= now() - make_interval(days => ${a.days})` : undefined,
    a.type === "inactive" ? sql`(${last} is null or ${last} < now() - make_interval(days => ${a.days}))` : undefined,
  );
}

export async function audienceCount(businessId: string, a: CampaignAudience) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(audienceWhere(businessId, a));
  return r?.n ?? 0;
}

/** Plafond d'envoi par jour : 50 pendant l'essai ou sans abonnement (contre le spam), 2 000 avec un abonnement payé. */
export async function dailyCap(businessId: string) {
  const p = await effectivePlan(businessId);
  const paid = (p.source === "stripe" || p.source === "account") && !p.isTrial;
  return paid ? 2000 : 50;
}

export async function sentToday(businessId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(campaignRecipients).where(and(eq(campaignRecipients.businessId, businessId), sql`${campaignRecipients.sentAt} > now() - interval '24 hours'`));
  return r?.n ?? 0;
}

export async function campaignsOf(businessId: string) {
  return db
    .select({ c: campaigns, sent: sql<number>`(select count(*)::int from campaign_recipients r where r.campaign_id = "campaigns"."id" and r.status = 'sent')`, unsub: sql<number>`(select count(*)::int from campaign_recipients r where r.campaign_id = "campaigns"."id" and r.unsubscribed_at is not null)` })
    .from(campaigns)
    .where(eq(campaigns.businessId, businessId))
    .orderBy(desc(campaigns.createdAt))
    .limit(200);
}

/** Envoi en tâche de fond (toutes les 15 min) : 300 emails max par passage, plafond quotidien par entreprise respecté. */
export async function processCampaignQueue(limit = 300) {
  const rows = await db
    .select({ r: campaignRecipients, subject: campaigns.subject, body: campaigns.body, bizName: businesses.name, tradeName: invoiceSettings.tradeName, replyTo: invoiceSettings.email })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .innerJoin(businesses, eq(businesses.id, campaignRecipients.businessId))
    .leftJoin(invoiceSettings, eq(invoiceSettings.businessId, campaignRecipients.businessId))
    .where(and(eq(campaignRecipients.status, "pending"), eq(campaigns.status, "sending"), isNull(businesses.deletedAt)))
    .orderBy(asc(campaigns.queuedAt))
    .limit(limit);
  const budget = new Map<string, number>();
  let sent = 0;
  for (const { r, subject, body, bizName, tradeName, replyTo } of rows) {
    if (!budget.has(r.businessId)) budget.set(r.businessId, (await dailyCap(r.businessId)) - (await sentToday(r.businessId)));
    if ((budget.get(r.businessId) ?? 0) <= 0) continue; // reste en attente : repart demain
    // Désabonné entre-temps (autre campagne) : on saute.
    const [c] = r.customerId ? await db.select({ out: customers.marketingOptOutAt }).from(customers).where(eq(customers.id, r.customerId)) : [];
    if (c?.out) { await db.update(campaignRecipients).set({ status: "skipped" }).where(eq(campaignRecipients.id, r.id)); continue; }
    const unsub = `${mkOrigin()}/desabonnement/${r.token}`;
    const mail = emails.campaign({ businessName: tradeName || bizName, subject, body: body.replaceAll("{prenom}", r.firstName ?? "").replace(/Bonjour\s+,/g, "Bonjour,"), unsubscribeUrl: unsub });
    const ok = await sendEmail({ to: r.email, ...mail, template: "campaign", businessId: r.businessId, replyTo: replyTo || null, headers: { "List-Unsubscribe": `<${unsub}>` } }).catch(() => false);
    await db.update(campaignRecipients).set({ status: ok ? "sent" : "failed", sentAt: new Date() }).where(eq(campaignRecipients.id, r.id));
    budget.set(r.businessId, (budget.get(r.businessId) ?? 0) - 1);
    if (ok) sent++;
  }
  // Campagnes terminées.
  await db.execute(sql`update campaigns set status = 'sent', sent_at = now() where status = 'sending' and not exists (select 1 from campaign_recipients r where r.campaign_id = campaigns.id and r.status = 'pending')`);
  return sent;
}
