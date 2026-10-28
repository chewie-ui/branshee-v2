"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, interventions, members, type InterventionPhoto } from "@/db/schema";
import { INTERVENTION_STATUS, isInterventionStatus } from "@/lib/interventions";
import { newLine, todayIso } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { getSellerSettings } from "@/server/invoicing";
import { canWork, interventionOf, interventionRights } from "@/server/interventions";
import { saveDocument } from "@/server/actions/invoicing";
import { deletePrivateFile, savePrivateFile, sniffImage } from "@/server/storage";

type Result = { ok: true; message?: string; id?: string; url?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const NF = { ok: false as const, error: "Intervention introuvable." };
const refresh = () => revalidatePath("/app/interventions", "layout");
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const saveSchema = z.object({
  id: z.uuid().optional(),
  customerId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  clientName: z.string().trim().max(120),
  clientPhone: opt(40),
  clientEmail: z.union([z.literal(""), z.email({ message: "Email invalide." })]).transform((v) => v.toLowerCase() || null),
  address: opt(300),
  title: z.string().trim().min(1, "Décrivez l'intervention en quelques mots.").max(160),
  description: opt(4000),
  technicianId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  scheduledAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).transform((v) => (v ? new Date(v) : null)),
  durationMinutes: z.number().int().min(15).max(24 * 60),
});

/** Créer ou modifier une intervention (responsable). Le client peut venir des fiches clients ou être tapé. */
export async function saveIntervention(input: z.input<typeof saveSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!interventionRights(ctx).manage) return { ok: false, error: "Seul le responsable planifie les interventions." };
  const v = saveSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  let client = { name: d.clientName, phone: d.clientPhone, email: d.clientEmail };
  if (d.customerId) {
    const [c] = await db.select().from(customers).where(and(eq(customers.id, d.customerId), eq(customers.businessId, ctx.business.id)));
    if (!c) return { ok: false, error: "Client introuvable." };
    client = { name: d.clientName || c.companyName || c.fullName, phone: d.clientPhone ?? c.phone, email: d.clientEmail ?? c.email };
    if (!d.address && c.street) d.address = [c.street, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }
  if (!client.name) return { ok: false, error: "Indiquez le client." };
  if (d.technicianId) {
    const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, d.technicianId), eq(members.businessId, ctx.business.id)));
    if (!m) return { ok: false, error: "Technicien introuvable." };
  }
  const values = { customerId: d.customerId, clientName: client.name, clientPhone: client.phone, clientEmail: client.email, address: d.address, title: d.title, description: d.description, technicianId: d.technicianId, scheduledAt: d.scheduledAt, durationMinutes: d.durationMinutes, updatedAt: new Date() };
  if (d.id) {
    const done = await db.update(interventions).set(values).where(and(eq(interventions.id, d.id), eq(interventions.businessId, ctx.business.id), isNull(interventions.signedAt))).returning({ id: interventions.id });
    if (!done.length) return { ok: false, error: "Intervention introuvable, ou déjà signée par le client (elle ne change plus)." };
    refresh();
    return { ok: true, message: "Intervention enregistrée.", id: d.id };
  }
  const id = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${ctx.business.id}:intervention`}))`);
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${interventions.number}), 0)::int + 1` }).from(interventions).where(eq(interventions.businessId, ctx.business.id));
    const [row] = await tx.insert(interventions).values({ ...values, businessId: ctx.business.id, number: n }).returning({ id: interventions.id });
    return row!.id;
  });
  refresh();
  return { ok: true, message: "Intervention planifiée.", id, url: `/app/interventions/${id}` };
}

/** Avancer le statut (technicien assigné ou responsable). « Commencer » et « Terminer » notent l'heure. */
export async function setInterventionStatus(id: string, status: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const r = await interventionOf(ctx.business.id, id);
  if (!r || !isInterventionStatus(status)) return NF;
  if (!canWork(ctx, r.i)) return { ok: false, error: "Cette intervention est confiée à quelqu'un d'autre." };
  if (status === "cancelled" && !interventionRights(ctx).manage) return { ok: false, error: "Seul le responsable peut annuler." };
  const now = new Date();
  const patch: Partial<typeof interventions.$inferInsert> = { status, updatedAt: now };
  if (status === "working" && !r.i.startedAt) patch.startedAt = now;
  if (status === "done") {
    patch.finishedAt = now;
    const start = r.i.startedAt ?? now;
    patch.laborMinutes = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));
  }
  await db.update(interventions).set(patch).where(eq(interventions.id, r.i.id));
  refresh();
  return { ok: true, message: `Intervention : ${INTERVENTION_STATUS[status].label.toLowerCase()}.` };
}

const workSchema = z.object({
  id: z.uuid(),
  report: z.string().trim().max(8000),
  items: z.array(z.object({ name: z.string().trim().min(1).max(160), qty: z.number().min(0.01).max(100000), unitCents: z.number().int().min(0).max(100_000_000), vatRate: z.number().refine((x) => [0, 6, 12, 21].includes(x)) })).max(100),
});

/** Rapport et fournitures / main-d'œuvre (technicien ou responsable). */
export async function saveInterventionWork(input: z.input<typeof workSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = workSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez le rapport et les lignes." };
  const r = await interventionOf(ctx.business.id, v.data.id);
  if (!r) return NF;
  if (!canWork(ctx, r.i)) return { ok: false, error: "Cette intervention est confiée à quelqu'un d'autre." };
  if (r.i.invoiceId) return { ok: false, error: "Déjà facturée : modifiez la facture." };
  if (r.i.signedAt) return { ok: false, error: "Signée par le client : le rapport ne peut plus changer." };
  await db.update(interventions).set({ report: v.data.report || null, items: v.data.items, updatedAt: new Date() }).where(eq(interventions.id, r.i.id));
  refresh();
  return { ok: true, message: "Rapport enregistré." };
}

/** Photo avant / après (image chiffrée, 10 Mo max, 30 photos max). */
export async function addInterventionPhoto(fd: FormData): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const id = String(fd.get("id") ?? "");
  const kind = fd.get("kind") === "after" ? "after" : "before";
  const file = fd.get("photo");
  const r = await interventionOf(ctx.business.id, id);
  if (!r) return NF;
  if (!canWork(ctx, r.i)) return { ok: false, error: "Cette intervention est confiée à quelqu'un d'autre." };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choisissez une photo." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (10 Mo maximum)." };
  if (r.i.photos.length >= 30) return { ok: false, error: "30 photos maximum par intervention." };
  const data = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(data)) return { ok: false, error: "Photo : JPG, PNG, WebP ou GIF." };
  const ref = await savePrivateFile(data);
  const photo: InterventionPhoto = { ref, kind, at: new Date().toISOString(), name: file.name.slice(0, 120) };
  await db.update(interventions).set({ photos: sql`${interventions.photos} || ${JSON.stringify([photo])}::jsonb`, updatedAt: new Date() }).where(eq(interventions.id, r.i.id));
  refresh();
  return { ok: true, message: "Photo ajoutée." };
}

export async function removeInterventionPhoto(id: string, ref: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const r = await interventionOf(ctx.business.id, id);
  if (!r) return NF;
  if (!canWork(ctx, r.i)) return { ok: false, error: "Action réservée." };
  const photo = r.i.photos.find((p) => p.ref === ref);
  if (!photo) return { ok: false, error: "Photo introuvable." };
  if (r.i.signedAt) return { ok: false, error: "Signée par le client : les photos ne changent plus." };
  await db.update(interventions).set({ photos: sql`(select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(${interventions.photos}) p where p->>'ref' <> ${ref})`, updatedAt: new Date() }).where(eq(interventions.id, r.i.id));
  await deletePrivateFile(ref).catch(() => {});
  refresh();
  return { ok: true, message: "Photo retirée." };
}

const signSchema = z.object({ id: z.uuid(), name: z.string().trim().min(2, "Nom du client ?").max(120), path: z.string().max(40_000).regex(/^[ML0-9 .-]+$/).refine((p) => (p.match(/L/g) ?? []).length >= 5, "Faites signer le client dans le cadre.") });

/** Signature du client sur le téléphone du technicien, en fin d'intervention. Envoie le rapport au client s'il a un email. */
export async function signIntervention(input: z.input<typeof signSchema>): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  const v = signSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Signature invalide." };
  const r = await interventionOf(ctx.business.id, v.data.id);
  if (!r) return NF;
  if (!canWork(ctx, r.i)) return { ok: false, error: "Cette intervention est confiée à quelqu'un d'autre." };
  if (r.i.signedAt) return { ok: false, error: "Déjà signée par le client." };
  const signed = await db.update(interventions).set({ signerName: v.data.name, signaturePath: v.data.path, signedAt: new Date(), updatedAt: new Date() }).where(and(eq(interventions.id, r.i.id), isNull(interventions.signedAt))).returning({ id: interventions.id });
  if (!signed.length) return { ok: false, error: "Déjà signée par le client." };
  if (r.i.clientEmail) {
    const seller = await getSellerSettings(ctx.business.id);
    await sendEmail({ to: r.i.clientEmail, ...emails.interventionReport({ sellerName: seller.tradeName || ctx.business.name, number: r.i.number, title: r.i.title, report: r.i.report, signer: v.data.name }), template: "intervention_report", businessId: ctx.business.id, replyTo: seller.email || null }).catch(() => {});
  }
  refresh();
  return { ok: true, message: r.i.clientEmail ? "Signé. Le rapport est envoyé au client par email." : "Signé par le client." };
}

/** Brouillon de facture depuis les lignes de l'intervention (fiche client créée si besoin). */
export async function invoiceIntervention(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!interventionRights(ctx).manage || !ctx.can("invoices.manage")) return { ok: false, error: "Vous n'avez pas le droit de créer des factures." };
  const r = await interventionOf(ctx.business.id, id);
  if (!r) return NF;
  if (r.i.invoiceId) return { ok: true, url: `/app/factures/${r.i.invoiceId}` };
  if (!r.i.items.length) return { ok: false, error: "Ajoutez d'abord les fournitures et la main-d'œuvre." };
  // La fiche client doit exister (et être enregistrée) avant le brouillon : la facture la relit sur une autre connexion.
  let customerId = r.i.customerId;
  if (!customerId) {
    const [existing] = r.i.clientEmail ? await db.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, ctx.business.id), sql`lower(${customers.email}) = ${r.i.clientEmail}`)) : [];
    customerId = existing?.id ?? (await db.insert(customers).values({ businessId: ctx.business.id, fullName: r.i.clientName, email: r.i.clientEmail, phone: r.i.clientPhone, createdManually: true }).returning({ id: customers.id }))[0]!.id;
    await db.update(interventions).set({ customerId }).where(eq(interventions.id, r.i.id));
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invoice-intervention:${r.i.id}`}))`);
    const [fresh] = await tx.select({ invoiceId: interventions.invoiceId }).from(interventions).where(eq(interventions.id, r.i.id));
    if (fresh?.invoiceId) return { ok: true as const, url: `/app/factures/${fresh.invoiceId}` };
    const seller = await getSellerSettings(ctx.business.id);
    const day = r.i.finishedAt ? new Intl.DateTimeFormat("en-CA", { timeZone: ctx.business.timezone }).format(r.i.finishedAt) : todayIso(ctx.business.timezone);
    const doc = await saveDocument({ docType: "invoice", customerId, issueDate: todayIso(ctx.business.timezone), serviceDate: day, notes: `Intervention n° ${r.i.number} : ${r.i.title}`, lines: r.i.items.map((it) => ({ ...newLine(), desc: it.name, qty: it.qty, unit: "pièce", price: it.unitCents / 100, vat: seller.vatRegime === "franchise" ? 0 : it.vatRate })) });
    if (!doc.ok || !doc.id) return { ok: false as const, error: doc.ok ? "Facture impossible." : doc.error };
    await tx.update(interventions).set({ invoiceId: doc.id }).where(eq(interventions.id, r.i.id));
    refresh();
    return { ok: true as const, message: "Brouillon de facture créé.", url: `/app/factures/${doc.id}` };
  });
}

export async function deleteIntervention(id: string): Promise<Result> {
  const ctx = await requireContext();
  if (ctx.impersonating) return SUPERVISION;
  if (!interventionRights(ctx).manage) return { ok: false, error: "Seul le responsable peut supprimer." };
  const r = await interventionOf(ctx.business.id, id);
  if (!r) return NF;
  if (r.i.signedAt) return { ok: false, error: "Une intervention signée par le client est conservée : annulez-la plutôt." };
  await db.delete(interventions).where(eq(interventions.id, r.i.id));
  for (const p of r.i.photos) await deletePrivateFile(p.ref).catch(() => {});
  refresh();
  return { ok: true, message: "Intervention supprimée.", url: "/app/interventions" };
}
