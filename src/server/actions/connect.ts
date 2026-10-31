"use server";

import { lookup } from "node:dns/promises";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, apiKeys, businesses, contactMessages, webhookDeliveries, webhooks } from "@/db/schema";
import { SCOPES, isEvent, isPrivateIp, isScope, newApiKey, newWebhookSecret, webhookUrlProblem } from "@/lib/connect";
import { encrypt } from "@/lib/field-crypto";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext, type AppContext } from "@/server/context";
import { deliver } from "@/server/connect";
import { recordContact } from "@/server/contact-messages";

type Result = { ok: true; message?: string; secret?: string; status?: number } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/reglages/site-connecte");
const log = (ctx: AppContext, action: string, description: string) => db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });

async function admin(): Promise<{ ctx: AppContext; error: null } | { ctx: AppContext; error: { ok: false; error: string } }> {
  const ctx = await requireContext("settings.manage", { write: true });
  if (ctx.impersonating) return { ctx, error: SUPERVISION };
  if (!ctx.member.isOwner && !ctx.can("settings.manage")) return { ctx, error: { ok: false, error: "Seul le responsable peut connecter un site." } };
  return { ctx, error: null };
}

/** Nouvelle clé secrète : montrée une seule fois, seule son empreinte est gardée. */
export async function createApiKey(name: string, scopes: string[]): Promise<Result> {
  const { ctx, error } = await admin();
  if (error) return error;
  const v = z.object({ name: z.string().trim().min(1, "Donnez un nom à la clé (ex. : Site vitrine).").max(60), scopes: z.array(z.string().refine(isScope)).min(1, "Choisissez au moins un droit.").max(Object.keys(SCOPES).length) }).safeParse({ name, scopes });
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(apiKeys).where(and(eq(apiKeys.businessId, ctx.business.id), isNull(apiKeys.revokedAt)));
  if (n >= 10) return { ok: false, error: "10 clés actives maximum : révoquez-en une d'abord." };
  const k = newApiKey();
  await db.insert(apiKeys).values({ businessId: ctx.business.id, name: v.data.name, prefix: k.prefix, keyHash: k.hash, scopes: [...new Set(v.data.scopes)], createdById: ctx.user.id });
  await log(ctx, "connect.key_created", `Site connecté : clé API « ${v.data.name} » créée (${v.data.scopes.join(", ")})`);
  refresh();
  return { ok: true, secret: k.key, message: "Clé créée. Copiez-la maintenant : elle ne sera plus affichée." };
}

export async function revokeApiKey(id: string): Promise<Result> {
  const { ctx, error } = await admin();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Clé introuvable." };
  const [k] = await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.businessId, ctx.business.id), isNull(apiKeys.revokedAt))).returning({ name: apiKeys.name });
  if (!k) return { ok: false, error: "Clé introuvable ou déjà révoquée." };
  await log(ctx, "connect.key_revoked", `Site connecté : clé API « ${k.name} » révoquée`);
  refresh();
  return { ok: true, message: "Clé révoquée : elle ne fonctionne plus, immédiatement." };
}

/** L'adresse doit pointer vers internet (pas vers le réseau du serveur Skydev). */
async function publicHost(url: string) {
  try {
    const addrs = await lookup(new URL(url).hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

export async function createWebhook(url: string, events: string[]): Promise<Result> {
  const { ctx, error } = await admin();
  if (error) return error;
  const problem = webhookUrlProblem(url);
  if (problem) return { ok: false, error: problem };
  const ev = [...new Set(events.filter(isEvent))];
  if (!ev.length) return { ok: false, error: "Choisissez au moins un événement." };
  if (!(await publicHost(url))) return { ok: false, error: "Cette adresse est introuvable ou n'est pas publique. Vérifiez le nom de domaine." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(webhooks).where(eq(webhooks.businessId, ctx.business.id));
  if (n >= 5) return { ok: false, error: "5 webhooks maximum." };
  const secret = newWebhookSecret();
  await db.insert(webhooks).values({ businessId: ctx.business.id, url: url.trim(), secret: encrypt(secret)!, events: ev });
  await log(ctx, "connect.webhook_created", `Site connecté : webhook ajouté vers ${new URL(url).hostname}`);
  refresh();
  return { ok: true, secret, message: "Webhook ajouté. Copiez le secret de signature maintenant : il ne sera plus affiché." };
}

export async function deleteWebhook(id: string): Promise<Result> {
  const { ctx, error } = await admin();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Webhook introuvable." };
  const [w] = await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.businessId, ctx.business.id))).returning({ url: webhooks.url });
  if (!w) return { ok: false, error: "Webhook introuvable." };
  await log(ctx, "connect.webhook_deleted", `Site connecté : webhook vers ${new URL(w.url).hostname} supprimé`);
  refresh();
  return { ok: true, message: "Webhook supprimé." };
}

/** Envoi d'essai (événement « test ») pour vérifier que le site reçoit et vérifie la signature. */
export async function testWebhook(id: string): Promise<Result> {
  const { ctx, error } = await admin();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Webhook introuvable." };
  if (!rateLimit(`hook-test:${ctx.business.id}`, 10, 60_000).ok) return { ok: false, error: "Trop d'essais : attendez une minute." };
  const [w] = await db.select({ id: webhooks.id }).from(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.businessId, ctx.business.id)));
  if (!w) return { ok: false, error: "Webhook introuvable." };
  const [d] = await db.insert(webhookDeliveries).values({ webhookId: w.id, businessId: ctx.business.id, event: "test", payload: { event: "test", createdAt: new Date().toISOString(), data: { message: "Essai depuis Skydev", business: ctx.business.name } } }).returning({ id: webhookDeliveries.id });
  const ok = await deliver(d!.id);
  // Un essai raté n'est pas renvoyé automatiquement.
  if (!ok) await db.update(webhookDeliveries).set({ status: "failed" }).where(eq(webhookDeliveries.id, d!.id));
  const [after] = await db.select({ status: webhooks.lastStatus, err: webhooks.lastError }).from(webhooks).where(eq(webhooks.id, w.id));
  refresh();
  return ok ? { ok: true, message: `Essai reçu par votre site (HTTP ${after?.status}).`, status: after?.status ?? 200 } : { ok: false, error: `Échec : ${after?.err ?? "pas de réponse"}.` };
}

// ─── Messages du formulaire de contact ───────────────────────────────────────

export async function setMessageRead(id: string, read: boolean): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "clients" });
  if (ctx.impersonating) return SUPERVISION;
  if (!ctx.can("customers.view") || !z.uuid().safeParse(id).success) return { ok: false, error: "Action impossible." };
  await db.update(contactMessages).set({ readAt: read ? new Date() : null }).where(and(eq(contactMessages.id, id), eq(contactMessages.businessId, ctx.business.id)));
  revalidatePath("/app/clients", "layout");
  return { ok: true };
}

export async function deleteContactMessage(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "clients" });
  if (ctx.impersonating) return SUPERVISION;
  if (!ctx.can("customers.manage") || !z.uuid().safeParse(id).success) return { ok: false, error: "Action impossible." };
  await db.delete(contactMessages).where(and(eq(contactMessages.id, id), eq(contactMessages.businessId, ctx.business.id)));
  revalidatePath("/app/clients", "layout");
  return { ok: true, message: "Message supprimé." };
}

const widgetSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email("Adresse email invalide."),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(5, "Votre message est un peu court.").max(4000),
  pageUrl: z.string().trim().max(500).optional(),
  /** Champ piège invisible : rempli seulement par les robots. */
  website: z.string().max(0).optional(),
});

/** Formulaire de contact intégré au site du pro (widget public, sans clé). */
export async function submitContactWidget(input: z.input<typeof widgetSchema>): Promise<Result> {
  if (input.website) return { ok: true, message: "Message envoyé, merci !" };
  const v = widgetSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const ip = clientIp(await headers()) ?? "local";
  if (!rateLimit(`contact-widget:${ip}`, 5, 60 * 60_000).ok || !rateLimit(`contact-widget-biz:${v.data.slug}`, 60, 60 * 60_000).ok) return { ok: false, error: "Trop de messages envoyés : réessayez plus tard." };
  const [b] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.slug, v.data.slug), isNull(businesses.deletedAt)));
  if (!b) return { ok: false, error: "Formulaire indisponible." };
  const r = await recordContact(b.id, { name: v.data.name, email: v.data.email, phone: v.data.phone || null, subject: v.data.subject || null, message: v.data.message, pageUrl: v.data.pageUrl || null }, "widget");
  return r ? { ok: true, message: "Message envoyé, merci ! Nous vous répondons rapidement." } : { ok: false, error: "L'envoi a échoué, réessayez." };
}
