"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, emailLogs, invoiceMailings, invoiceReminderSettings } from "@/db/schema";
import { clampRule } from "@/lib/invoice-reminders";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { getDocument } from "@/server/invoicing";
import { eur, invoiceUrl, longDate } from "@/server/invoice-mailing";
import { newSignToken } from "@/server/signatures";

type Result = { ok: true; message?: string; url?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };

/** Envoie la facture (ou la note de crédit) émise au client, avec un lien pour la voir et la payer. Renvoyer garde le même lien. */
export async function sendInvoiceByEmail(documentId: string, email: string): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const e = z.email().safeParse(email.trim().toLowerCase());
  if (!e.success) return { ok: false, error: "Adresse email invalide." };
  const d = await getDocument(ctx.business.id, documentId);
  if (!d || (d.docType !== "invoice" && d.docType !== "credit")) return { ok: false, error: "Facture introuvable." };
  if (d.status === "draft" || !d.number) return { ok: false, error: "Émettez d'abord la facture : un brouillon ne s'envoie pas." };
  if (d.status === "cancelled") return { ok: false, error: "Cette facture est annulée par une note de crédit : envoyez plutôt la note de crédit." };
  // Plafond sur les emails réellement partis (un renvoi compte aussi), et pas de renvoi en rafale du même document.
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(emailLogs).where(and(eq(emailLogs.businessId, ctx.business.id), eq(emailLogs.template, "invoice_sent"), gte(emailLogs.createdAt, new Date(Date.now() - 86400_000))));
  if (n >= 100) return { ok: false, error: "100 envois de factures en 24 heures : réessayez demain." };
  const [prev] = await db.select({ at: invoiceMailings.sentAt }).from(invoiceMailings).where(and(eq(invoiceMailings.businessId, ctx.business.id), eq(invoiceMailings.documentId, d.id)));
  if (prev && Date.now() - prev.at.getTime() < 10 * 60_000) return { ok: false, error: "Déjà envoyée il y a quelques minutes : attendez un peu avant de renvoyer." };
  const [m] = await db
    .insert(invoiceMailings)
    .values({ businessId: ctx.business.id, documentId: d.id, token: newSignToken(), email: e.data })
    .onConflictDoUpdate({ target: invoiceMailings.documentId, set: { email: e.data, sentAt: new Date() } })
    .returning({ token: invoiceMailings.token });
  const seller = String(d.seller?.tradeName || d.seller?.legalName || ctx.business.name);
  const url = invoiceUrl(m!.token);
  const ok = await sendEmail({
    to: e.data,
    ...emails.invoiceSent({ sellerName: seller, number: d.number, amount: eur(d.ttcCents), due: d.dueDate ? longDate(d.dueDate) : null, url, credit: d.docType === "credit" }),
    template: "invoice_sent",
    businessId: ctx.business.id,
    replyTo: String(d.seller?.email || "") || null,
  });
  if (ok) await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "invoice.email", description: `${d.docType === "credit" ? "Note de crédit" : "Facture"} ${d.number} envoyée à ${e.data}` });
  revalidatePath(`/app/factures/${d.id}`);
  return ok ? { ok: true, message: `Envoyée à ${e.data}.`, url } : { ok: false, error: "L'email n'a pas pu partir. Le lien reste utilisable : copiez-le." };
}

/** Coupe ou relance les rappels automatiques pour une facture. */
export async function setInvoiceReminders(documentId: string, on: boolean): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(documentId).success) return { ok: false, error: "Facture introuvable." };
  const done = await db.update(invoiceMailings).set({ remindersOff: !on }).where(and(eq(invoiceMailings.businessId, ctx.business.id), eq(invoiceMailings.documentId, documentId))).returning({ id: invoiceMailings.id });
  if (!done.length) return { ok: false, error: "Envoyez d'abord la facture par email." };
  revalidatePath(`/app/factures/${documentId}`);
  return { ok: true, message: on ? "Rappels automatiques réactivés pour cette facture." : "Plus de rappel automatique pour cette facture." };
}

const ruleSchema = z.object({ enabled: z.boolean(), firstDays: z.coerce.number(), everyDays: z.coerce.number(), maxReminders: z.coerce.number() });

/** Réglage de l'entreprise : relancer automatiquement les factures échues envoyées depuis Skydev. */
export async function saveReminderSettings(input: z.input<typeof ruleSchema>): Promise<Result> {
  const ctx = await requireContext("invoices.manage", { app: "factures" });
  if (ctx.impersonating) return SUPERVISION;
  const v = ruleSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez les réglages." };
  const values = { enabled: v.data.enabled, ...clampRule(v.data) };
  await db.insert(invoiceReminderSettings).values({ businessId: ctx.business.id, ...values }).onConflictDoUpdate({ target: invoiceReminderSettings.businessId, set: values });
  revalidatePath("/app/factures/reglages");
  return { ok: true, message: values.enabled ? `Relances activées : ${values.firstDays} jours après l'échéance, puis tous les ${values.everyDays} jours (${values.maxReminders} au plus).` : "Relances automatiques coupées." };
}

