"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businessFeatures, customRequests, members, users } from "@/db/schema";
import { APPS } from "@/lib/apps";
import { CUSTOM_FEATURES, REQUEST_STATUS, clientCan, fmtEuros } from "@/lib/custom-work";
import { requireSuperadmin } from "@/server/admin";
import { requireContext } from "@/server/context";
import { requestById, ownRequest } from "@/server/custom-work";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const origin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
const adminTo = () => process.env.SKYDEV_CONTACT_EMAIL || "info@skydev.be";

const reqSchema = z.object({
  appId: z.string().max(40).default(""),
  title: z.string().trim().min(3, "Donnez un titre court à votre demande.").max(120),
  description: z.string().trim().min(10, "Décrivez un peu plus ce que vous voulez.").max(5000),
});

/** Demander une modif ou un outil sur mesure (réservé au responsable : c'est payant). */
export async function submitCustomRequest(input: z.input<typeof reqSchema>): Promise<Result> {
  const ctx = await requireContext(undefined, { write: true });
  if (ctx.impersonating) return { ok: false, error: "Lecture seule pendant la supervision." };
  if (!(ctx.member.isOwner || ctx.can("settings.manage"))) return { ok: false, error: "Seul le responsable peut faire une demande sur mesure." };
  const v = reqSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez la demande." };
  const appId = APPS.some((a) => a.id === v.data.appId) ? v.data.appId : null;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(customRequests).where(and(eq(customRequests.businessId, ctx.business.id), gte(customRequests.createdAt, new Date(Date.now() - 86400_000))));
  if (n >= 10) return { ok: false, error: "10 demandes en 24 heures : réessayez demain, ou appelez-nous." };
  const [r] = await db.insert(customRequests).values({ businessId: ctx.business.id, userId: ctx.user.id, appId, title: v.data.title, description: v.data.description }).returning({ id: customRequests.id });
  await sendEmail({ to: adminTo(), ...emails.customRequestAdmin({ business: ctx.business.name, title: v.data.title, text: `${v.data.description}\n\n${ctx.user.name} · ${ctx.user.email}`, event: "Nouvelle demande", url: `${origin()}/admin/sur-mesure/${r!.id}` }), template: "custom_request_admin", replyTo: ctx.user.email }).catch(() => {});
  revalidatePath("/app/sur-mesure");
  return { ok: true, message: "Demande envoyée : nous revenons vers vous avec un prix, en général sous 48 heures.", id: r!.id };
}

/** Le client accepte ou refuse le prix proposé, ou annule sa demande. */
export async function answerCustomRequest(id: string, action: "accept" | "decline" | "cancel"): Promise<Result> {
  const ctx = await requireContext(undefined, { write: true });
  if (ctx.impersonating) return { ok: false, error: "Lecture seule pendant la supervision." };
  if (!(ctx.member.isOwner || ctx.can("settings.manage"))) return { ok: false, error: "Réservé au responsable." };
  if (!["accept", "decline", "cancel"].includes(action)) return { ok: false, error: "Action inconnue." };
  const r = await ownRequest(ctx.business.id, id);
  if (!r || !clientCan(r.status, action)) return { ok: false, error: "Cette demande ne peut plus changer." };
  const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
  const from = action === "cancel" ? ["new", "quoted"] : ["quoted"];
  const done = await db.update(customRequests).set({ status, ...(action === "accept" ? { acceptedAt: new Date() } : {}), updatedAt: new Date() }).where(and(eq(customRequests.id, r.id), inArray(customRequests.status, from))).returning({ id: customRequests.id });
  if (!done.length) return { ok: false, error: "Cette demande ne peut plus changer." };
  await sendEmail({ to: adminTo(), ...emails.customRequestAdmin({ business: ctx.business.name, title: r.title, text: `${ctx.user.name} : ${action === "accept" ? "prix accepté" : action === "decline" ? "prix refusé" : "demande annulée"}`, event: action === "accept" ? "Prix accepté" : action === "decline" ? "Prix refusé" : "Demande annulée", url: `${origin()}/admin/sur-mesure/${r.id}` }), template: "custom_request_admin" }).catch(() => {});
  revalidatePath("/app/sur-mesure");
  return { ok: true, message: action === "accept" ? "Merci ! Nous commençons et vous prévenons dès que c'est prêt." : action === "decline" ? "Prix refusé : n'hésitez pas à nous dire ce qui coince." : "Demande annulée." };
}

const adminSchema = z.object({
  status: z.enum(Object.keys(REQUEST_STATUS) as [string, ...string[]]),
  setupCents: z.number().int().min(0).max(10_000_000).nullable(),
  monthlyCents: z.number().int().min(0).max(1_000_000).nullable(),
  reply: z.string().trim().max(5000),
  notify: z.boolean(),
});

/** Admin Skydev : répondre (prix, avancement, livraison) et prévenir le client. */
export async function adminUpdateCustomRequest(id: string, input: z.input<typeof adminSchema>): Promise<Result> {
  await requireSuperadmin();
  const v = adminSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez les champs." };
  const r = await requestById(id);
  if (!r) return { ok: false, error: "Demande introuvable." };
  const d = v.data;
  // Prix accepté par le client : figé (pas de changement après coup).
  if (r.r.acceptedAt && (d.setupCents !== r.r.setupCents || d.monthlyCents !== r.r.monthlyCents)) return { ok: false, error: "Le client a déjà accepté ce prix : il ne peut plus changer. Faites une nouvelle proposition dans une autre demande." };
  await db.update(customRequests).set({ status: d.status, setupCents: d.setupCents, monthlyCents: d.monthlyCents, reply: d.reply || null, ...(d.status === "quoted" && r.r.status !== "quoted" ? { quotedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(customRequests.id, id));
  if (d.notify) {
    // Le responsable de l'entreprise (et la personne qui a demandé) est prévenu par email.
    const owners = await db.select({ email: users.email }).from(members).innerJoin(users, eq(users.id, members.userId)).where(and(eq(members.businessId, r.businessId), eq(members.isOwner, true)));
    const to = [...new Set([r.email, ...owners.map((o) => o.email)].filter(Boolean) as string[])];
    const price = [d.setupCents ? `${fmtEuros(d.setupCents)} une fois` : null, d.monthlyCents ? `${fmtEuros(d.monthlyCents)} par mois` : null].filter(Boolean).join(" + ") || null;
    for (const email of to) await sendEmail({ to: email, ...emails.customRequestUpdate({ title: r.r.title, status: REQUEST_STATUS[d.status as keyof typeof REQUEST_STATUS].label, reply: d.reply || null, price: d.status === "quoted" ? price : null, url: `${origin()}/app/sur-mesure` }), template: "custom_request_update", businessId: r.businessId }).catch(() => {});
  }
  revalidatePath(`/admin/sur-mesure/${id}`);
  return { ok: true, message: d.notify ? "Enregistré, client prévenu." : "Enregistré." };
}

/** Admin Skydev : activer ou couper une fonctionnalité sur mesure pour une entreprise. */
export async function adminSetFeature(businessId: string, key: string, on: boolean, monthlyCents = 0, requestId: string | null = null): Promise<Result> {
  await requireSuperadmin();
  if (!z.uuid().safeParse(businessId).success || !CUSTOM_FEATURES[key]) return { ok: false, error: "Fonctionnalité inconnue." };
  if (on) await db.insert(businessFeatures).values({ businessId, key, monthlyCents: Math.max(0, Math.round(monthlyCents) || 0), requestId: requestId && z.uuid().safeParse(requestId).success ? requestId : null }).onConflictDoUpdate({ target: [businessFeatures.businessId, businessFeatures.key], set: { monthlyCents: Math.max(0, Math.round(monthlyCents) || 0) } });
  else await db.delete(businessFeatures).where(and(eq(businessFeatures.businessId, businessId), eq(businessFeatures.key, key)));
  revalidatePath("/admin/sur-mesure");
  return { ok: true, message: on ? "Activée pour cette entreprise." : "Coupée." };
}
