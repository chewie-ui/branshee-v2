import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, campaignRecipients, campaigns, customers, invoiceSettings, type CampaignAudience } from "@/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { effectivePlan, isLocked } from "@/server/plan";
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

/** Emails partis (ou en cours d'envoi) sur 24 h, sans compter les lignes que ce passage vient de réserver. */
export async function sentToday(businessId: string, exclude: string[] = []) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(campaignRecipients).where(and(eq(campaignRecipients.businessId, businessId), inArray(campaignRecipients.status, ["sent", "failed", "sending"]), sql`${campaignRecipients.sentAt} > now() - interval '24 hours'`, exclude.length ? notInArray(campaignRecipients.id, exclude) : undefined));
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

/**
 * Envoi en tâche de fond (toutes les 15 min) : 300 emails max par passage, plafond quotidien par entreprise.
 * Les lignes sont « réservées » d'abord (SKIP LOCKED) : deux passages simultanés n'envoient jamais deux fois le même email.
 */
export async function processCampaignQueue(limit = 300) {
  // Réservations abandonnées (serveur arrêté en plein envoi) : remises en attente après 3 heures.
  await db.execute(sql`update campaign_recipients set status = 'pending', sent_at = null where status = 'sending' and sent_at < now() - interval '3 hours'`);
  // Entreprises à laisser de côté pour ce passage (lecture seule ou plafond du jour atteint) : exclues dès la sélection,
  // pour qu'elles ne bloquent jamais les envois des autres en tête de file.
  const busy = await db.selectDistinct({ id: campaigns.businessId }).from(campaigns).where(eq(campaigns.status, "sending"));
  const held: string[] = [];
  for (const { id } of busy) if ((await isLocked(id)) || (await dailyCap(id)) - (await sentToday(id)) <= 0) held.push(id);
  const heldSql = held.length ? sql`and not (c.business_id = any(${sql.raw(`array[${held.map((h) => `'${h.replace(/[^0-9a-f-]/gi, "")}'`).join(",")}]::uuid[]`)}))` : sql``;
  const claimed = await db.execute<{ id: string }>(sql`
    update campaign_recipients set status = 'sending', sent_at = now()
    where id in (
      select r.id from campaign_recipients r join campaigns c on c.id = r.campaign_id
      where r.status = 'pending' and c.status = 'sending' ${heldSql}
      order by c.queued_at limit ${limit}
      for update of r skip locked
    ) returning id`);
  const ids = [...claimed].map((r) => r.id);
  if (!ids.length) return 0;
  const rows = await db
    .select({ r: campaignRecipients, subject: campaigns.subject, body: campaigns.body, bizName: businesses.name, deleted: businesses.deletedAt, tradeName: invoiceSettings.tradeName, replyTo: invoiceSettings.email })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .innerJoin(businesses, eq(businesses.id, campaignRecipients.businessId))
    .leftJoin(invoiceSettings, eq(invoiceSettings.businessId, campaignRecipients.businessId))
    .where(inArray(campaignRecipients.id, ids));
  const budget = new Map<string, number>();
  let sent = 0;
  for (const { r, subject, body, bizName, deleted, tradeName, replyTo } of rows) {
    if (deleted) { await db.update(campaignRecipients).set({ status: "skipped" }).where(eq(campaignRecipients.id, r.id)); continue; }
    // Espace en lecture seule (essai terminé) : l'envoi attend l'abonnement.
    if (await isLocked(r.businessId)) { await db.update(campaignRecipients).set({ status: "pending", sentAt: null }).where(eq(campaignRecipients.id, r.id)); continue; }
    if (!budget.has(r.businessId)) budget.set(r.businessId, (await dailyCap(r.businessId)) - (await sentToday(r.businessId, ids)));
    if ((budget.get(r.businessId) ?? 0) <= 0) { await db.update(campaignRecipients).set({ status: "pending", sentAt: null }).where(eq(campaignRecipients.id, r.id)); continue; }
    // Désabonné ou bloqué entre-temps (sur n'importe quelle fiche avec cette adresse) : on saute.
    const [out] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, r.businessId), sql`lower(${customers.email}) = ${r.email}`, sql`(${customers.marketingOptOutAt} is not null or ${customers.blockedAt} is not null)`)).limit(1);
    if (out) { await db.update(campaignRecipients).set({ status: "skipped" }).where(eq(campaignRecipients.id, r.id)); continue; }
    const unsub = `${mkOrigin()}/desabonnement/${r.token}`;
    const mail = emails.campaign({ businessName: tradeName || bizName, subject: subject.replaceAll("{prenom}", r.firstName ?? "").replace(/\s{2,}/g, " ").replace(/\s+([,!?.])/g, "$1").trim(), body: body.replaceAll("{prenom}", r.firstName ?? "").replace(/Bonjour\s+,/g, "Bonjour,"), unsubscribeUrl: unsub });
    const ok = await sendEmail({ to: r.email, ...mail, template: "campaign", businessId: r.businessId, replyTo: replyTo || null, headers: { "List-Unsubscribe": `<${unsub}/un-clic>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }).catch(() => false);
    await db.update(campaignRecipients).set({ status: ok ? "sent" : "failed", sentAt: new Date() }).where(eq(campaignRecipients.id, r.id));
    budget.set(r.businessId, (budget.get(r.businessId) ?? 0) - 1);
    if (ok) sent++;
  }
  // Campagnes terminées.
  await db.execute(sql`update campaigns set status = 'sent', sent_at = now() where status = 'sending' and not exists (select 1 from campaign_recipients r where r.campaign_id = campaigns.id and r.status in ('pending', 'sending'))`);
  return sent;
}
