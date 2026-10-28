"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignRecipients, campaigns, customers } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { getSellerSettings } from "@/server/invoicing";
import { audienceCount, audienceWhere, dailyCap, marketingRights, mkOrigin, newMkToken, sentToday } from "@/server/marketing";

type Result = { ok: true; message?: string; id?: string; count?: number } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/marketing", "layout");
const audienceSchema = z.object({ type: z.enum(["all", "recent", "inactive"]), days: z.number().int().min(7).max(1095) });
const campaignSchema = z.object({
  id: z.uuid().optional(),
  subject: z.string().trim().min(3, "Écrivez un objet.").max(120),
  body: z.string().trim().min(10, "Écrivez votre message.").max(5000),
  audience: audienceSchema,
});

async function manager() {
  const ctx = await requireContext();
  if (ctx.impersonating) return { ctx, error: SUPERVISION };
  if (!marketingRights(ctx).manage) return { ctx, error: { ok: false as const, error: "Seul le responsable envoie des campagnes." } };
  return { ctx, error: null };
}

export async function countAudience(audience: z.input<typeof audienceSchema>): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  const a = audienceSchema.safeParse(audience);
  if (!a.success) return { ok: false, error: "Audience invalide." };
  return { ok: true, count: await audienceCount(ctx.business.id, a.data) };
}

export async function saveCampaign(input: z.input<typeof campaignSchema>): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  const v = campaignSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez la campagne." };
  const d = v.data;
  if (d.id) {
    const done = await db.update(campaigns).set({ subject: d.subject, body: d.body, audience: d.audience, updatedAt: new Date() }).where(and(eq(campaigns.id, d.id), eq(campaigns.businessId, ctx.business.id), eq(campaigns.status, "draft"))).returning({ id: campaigns.id });
    if (!done.length) return { ok: false, error: "Campagne introuvable ou déjà envoyée." };
    refresh();
    return { ok: true, id: d.id, message: "Brouillon enregistré." };
  }
  const [row] = await db.insert(campaigns).values({ businessId: ctx.business.id, subject: d.subject, body: d.body, audience: d.audience, createdById: ctx.member.id }).returning({ id: campaigns.id });
  refresh();
  return { ok: true, id: row!.id, message: "Brouillon enregistré." };
}

/** Email de test à soi-même (5 par heure). */
export async function testCampaign(id: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Campagne introuvable." };
  if (!rateLimit(`mk-test:${ctx.business.id}`, 5, 3600_000).ok) return { ok: false, error: "5 tests par heure maximum." };
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.businessId, ctx.business.id)));
  if (!c) return { ok: false, error: "Campagne introuvable." };
  const seller = await getSellerSettings(ctx.business.id);
  const mail = emails.campaign({ businessName: seller.tradeName || ctx.business.name, subject: `[Test] ${c.subject}`, body: c.body.replaceAll("{prenom}", ctx.user.name.split(" ")[0] ?? ""), unsubscribeUrl: `${mkOrigin()}/app/marketing` });
  const ok = await sendEmail({ to: ctx.user.email, ...mail, template: "campaign_test", businessId: ctx.business.id });
  return ok ? { ok: true, message: `Test envoyé à ${ctx.user.email}.` } : { ok: false, error: "L'email de test n'a pas pu partir." };
}

/** Lancer l'envoi : la liste des destinataires est figée maintenant, l'envoi se fait par vagues (plafond quotidien). */
export async function sendCampaign(id: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Campagne introuvable." };
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.businessId, ctx.business.id))).for("update");
    if (!c) return { ok: false as const, error: "Campagne introuvable." };
    if (c.status !== "draft") return { ok: false as const, error: "Cette campagne est déjà partie." };
    const list = await tx.select({ id: customers.id, email: customers.email, first: customers.firstName, full: customers.fullName }).from(customers).where(audienceWhere(ctx.business.id, c.audience)).limit(20000);
    if (!list.length) return { ok: false as const, error: "Personne dans cette audience." };
    const seen = new Set<string>();
    const rows = list.filter((x) => x.email && !seen.has(x.email.toLowerCase()) && seen.add(x.email.toLowerCase())).map((x) => ({ businessId: ctx.business.id, campaignId: c.id, customerId: x.id, email: x.email!.toLowerCase(), firstName: x.first || x.full.split(" ")[0] || null, token: newMkToken() }));
    for (let i = 0; i < rows.length; i += 1000) await tx.insert(campaignRecipients).values(rows.slice(i, i + 1000)).onConflictDoNothing();
    await tx.update(campaigns).set({ status: "sending", recipients: rows.length, queuedAt: new Date(), updatedAt: new Date() }).where(eq(campaigns.id, c.id));
    refresh();
    const left = Math.max(0, (await dailyCap(ctx.business.id)) - (await sentToday(ctx.business.id)));
    return { ok: true as const, message: rows.length > left ? `Envoi lancé pour ${rows.length} clients : ${left} aujourd'hui, la suite les jours suivants (plafond quotidien).` : `Envoi lancé pour ${rows.length} client${rows.length > 1 ? "s" : ""}. Les emails partent dans les minutes qui viennent.` };
  });
}

export async function deleteCampaign(id: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Campagne introuvable." };
  const gone = await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.businessId, ctx.business.id), eq(campaigns.status, "draft"))).returning({ id: campaigns.id });
  if (!gone.length) return { ok: false, error: "Seul un brouillon peut être supprimé." };
  refresh();
  return { ok: true, message: "Brouillon supprimé." };
}

/** Arrêter une campagne en cours : les emails pas encore partis sont annulés. */
export async function stopCampaign(id: string): Promise<Result> {
  const { ctx, error } = await manager();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Campagne introuvable." };
  const [c] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.businessId, ctx.business.id), eq(campaigns.status, "sending")));
  if (!c) return { ok: false, error: "Campagne introuvable ou terminée." };
  await db.update(campaignRecipients).set({ status: "skipped" }).where(and(eq(campaignRecipients.campaignId, c.id), eq(campaignRecipients.status, "pending")));
  await db.update(campaigns).set({ status: "sent", sentAt: new Date() }).where(eq(campaigns.id, c.id));
  refresh();
  return { ok: true, message: "Envoi arrêté." };
}

/** Désabonnement (page publique, sans compte). */
export async function unsubscribe(token: string): Promise<Result> {
  if (!/^[\w-]{16,40}$/.test(token)) return { ok: false, error: "Lien invalide." };
  if (!rateLimit(`unsub:${clientIp(await headers()) ?? "?"}`, 30, 3600_000).ok) return { ok: false, error: "Réessayez plus tard." };
  const [r] = await db.select({ id: campaignRecipients.id, customerId: campaignRecipients.customerId }).from(campaignRecipients).where(eq(campaignRecipients.token, token));
  if (!r) return { ok: false, error: "Lien invalide." };
  await db.update(campaignRecipients).set({ unsubscribedAt: sql`coalesce(${campaignRecipients.unsubscribedAt}, now())` }).where(eq(campaignRecipients.id, r.id));
  if (r.customerId) await db.update(customers).set({ marketingOptOutAt: new Date() }).where(and(eq(customers.id, r.customerId), isNull(customers.marketingOptOutAt)));
  return { ok: true, message: "C'est fait : vous ne recevrez plus ces emails." };
}
