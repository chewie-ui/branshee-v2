"use server";

import { humanDateTime } from "@/lib/time";
import { LOCALES } from "@/i18n/config";

import { headers } from "next/headers";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, appointmentPayments, appointments, customers, paymentSettings, waitlistEntries } from "@/db/schema";
import { stripe } from "@/server/payments";
import { autoConfirmAllowed } from "@/server/plan";
import { getAvailableSlots } from "@/server/availability";
import { rateLimit } from "@/server/auth/rate-limit";
import { notifyAutoConfirmLimit, notifyBookingCreated } from "@/server/notifications";
import { checkIntake, getPublicBusiness } from "@/server/public";
import { policyAmounts } from "@/lib/cancellation";
import { policyText } from "@/lib/cancellation-text";
import { getSessionUser } from "@/server/auth/session";
import { clientIp } from "@/lib/client-ip";

async function ip() {
  const h = await headers();
  return (clientIp(h) ?? "unknown");
}

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function nextDays(from: string, count: number) {
  const out: string[] = [];
  const d = new Date(from + "T12:00:00Z");
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export type PublicDay = { date: string; slots: { time: string; memberIds: string[]; grouped?: boolean }[] };

/** Créneaux libres d'une prestation sur quelques jours (page publique, sans connexion). */
export async function getPublicSlots(slug: string, serviceId: string, memberId: string | null, fromDay: string, count = 7): Promise<PublicDay[]> {
  if (!rateLimit(`slots:${await ip()}`, 120, 60_000).ok) return [];
  const parsed = z.object({ serviceId: z.uuid(), memberId: z.uuid().nullable(), fromDay: isoDay, count: z.number().int().min(1).max(14) }).safeParse({ serviceId, memberId, fromDay, count });
  if (!parsed.success) return [];
  const data = await getPublicBusiness(slug);
  if (!data || data.closed) return [];
  const service = data.services.find((s) => s.id === serviceId);
  if (!service || (memberId && !service.memberIds.includes(memberId))) return [];

  const days = nextDays(fromDay, count);
  const slots = await getAvailableSlots({ businessId: data.business.id, serviceId, memberId: memberId ?? undefined, days });
  return days.map((date) => ({ date, slots: (slots[date] ?? []).map((s) => ({ time: s.time, memberIds: s.memberIds, ...(s.grouped ? { grouped: true } : {}) })) }));
}

const bookingSchema = z.object({
  slug: z.string().min(1).max(80),
  serviceId: z.uuid(),
  memberId: z.uuid().nullable(),
  date: isoDay,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(60),
  lastName: z.string().trim().min(1, "Indiquez votre nom.").max(60),
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  phone: z.string().trim().max(40),
  message: z.string().trim().max(1000),
  answers: z.record(z.string(), z.string().max(1000)),
  /** Réponses au questionnaire d'orientation : id de question → id de réponse. */
  intake: z.record(z.string(), z.string().max(64)).optional(),
  /** Champ piège invisible : rempli uniquement par les robots. */
  website: z.string().max(0).optional(),
  locale: z.enum(LOCALES).optional(),
  paymentMethod: z.enum(["online", "on_site", "bank_transfer", "paypal", "none"]).optional(),
  /** Case « J'accepte les conditions d'annulation » (obligatoire dès qu'une carte ou un paiement est demandé avec des frais). */
  acceptPolicy: z.boolean().optional(),
  paymentIntentId: z.string().regex(/^pi_\w+$/).optional(),
  setupIntentId: z.string().regex(/^seti_\w+$/).optional(),
});

export type BookingResult = { ok: true; token: string } | { ok: false; error: string; fieldErrors?: Record<string, string>; slotTaken?: boolean };

export async function createPublicBooking(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const clientIp = await ip();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;
  // Compté après la validation : une faute de frappe dans le formulaire ne consomme pas le quota.
  if (!rateLimit(`book:${clientIp}:${v.slug}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de réservations depuis cette connexion. Réessayez plus tard ou appelez l'établissement." };

  const data = await getPublicBusiness(v.slug);
  if (!data || !data.settings) return { ok: false, error: "Établissement introuvable." };
  if (data.closed) return { ok: false, error: "Cet établissement ne prend pas de réservation en ligne pour le moment." };
  const service = data.services.find((s) => s.id === v.serviceId);
  if (!service) return { ok: false, error: "Cette prestation n'est plus disponible." };

  if (data.settings.phoneRequired && v.phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: { phone: "Indiquez un numéro de téléphone." } };

  const intake = checkIntake(data, service.id, v.intake ?? {});
  if (!intake.ok) return { ok: false, error: "Cette prestation ne correspond pas à vos réponses. Revenez en arrière pour en choisir une autre." };

  // Questions du formulaire : obligatoires remplies, réponses aux questions à choix valides.
  const answers: { question: string; answer: string }[] = [...intake.lines];
  for (const q of data.questions) {
    const a = (v.answers[q.id] ?? "").trim();
    if (q.isRequired && !a) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: { [`q_${q.id}`]: "Réponse obligatoire." } };
    if (a && q.type === "choice" && !q.options.includes(a)) return { ok: false, error: "Réponse invalide." };
    if (a && q.type === "yes_no" && !["Oui", "Non"].includes(a)) return { ok: false, error: "Réponse invalide." };
    if (a) answers.push({ question: q.label, answer: a });
  }

  // ── Paiement : vérifié auprès de Stripe, jamais d'après ce qu'envoie le navigateur ──
  const method = v.paymentMethod ?? "none";
  const price = service.priceCents ?? 0;
  const pay = data.payment;
  let payment: (Partial<typeof appointmentPayments.$inferInsert> & { method: typeof method }) | null = price > 0 && method !== "none" ? { method, amountCents: price, status: "none" } : null;
  // Consentement aux frais d'annulation / d'absence : exigé quand ils pourront être prélevés (carte en garantie ou paiement en ligne).
  // Dès que le pro a une politique payante, le client l'accepte (même si rien n'est encore prélevable en ligne).
  const amounts = policyAmounts(pay.rule, price, service.cancellationFeeType ? { type: service.cancellationFeeType, value: service.cancellationFeeValue } : null);
  if (amounts && !v.acceptPolicy) return { ok: false, error: "Acceptez les conditions d'annulation pour réserver.", fieldErrors: { acceptPolicy: "Acceptez les conditions d'annulation pour réserver." } };
  const policyConsent = amounts
    ? { acceptedAt: new Date().toISOString(), ...amounts, locale: v.locale ?? "fr", ip: clientIp === "local" ? null : clientIp, text: policyText(v.locale ?? "fr", amounts) }
    : null;
  if (pay.required && price > 0 && method !== "online") return { ok: false, error: "Le paiement en ligne est obligatoire pour cette prestation." };
  if (method === "online") {
    if (!pay.online || price <= 0 || !v.paymentIntentId) return { ok: false, error: "Paiement en ligne indisponible." };
    const pi = await stripe()?.paymentIntents.retrieve(v.paymentIntentId).catch(() => null);
    if (!pi || pi.status !== "succeeded" || (pi.amount_received ?? 0) < price || pi.metadata.businessId !== data.business.id) {
      return { ok: false, error: "Le paiement n'a pas pu être vérifié. Réessayez ou contactez l'établissement." };
    }
    // Un paiement ne sert qu'à une seule réservation.
    const [used] = await db.select({ id: appointmentPayments.appointmentId }).from(appointmentPayments).where(eq(appointmentPayments.stripePaymentIntentId, pi.id));
    if (used) return { ok: false, error: "Ce paiement a déjà servi pour une réservation." };
    const pm = typeof pi.payment_method === "string" ? await stripe()!.paymentMethods.retrieve(pi.payment_method).catch(() => null) : null;
    payment = { method, status: "paid", amountCents: pi.amount_received, stripePaymentIntentId: pi.id, cardBrand: pm?.card?.brand ?? null, cardLast4: pm?.card?.last4 ?? null, paidAt: new Date() };
  } else if (pay.guarantee && price > 0) {
    if (!v.setupIntentId) return { ok: false, error: "Une carte en garantie est demandée pour ce rendez-vous." };
    const si = await stripe()?.setupIntents.retrieve(v.setupIntentId).catch(() => null);
    if (!si || si.status !== "succeeded" || si.metadata?.businessId !== data.business.id || typeof si.payment_method !== "string") return { ok: false, error: "La carte n'a pas pu être vérifiée. Réessayez." };
    const [used] = await db.select({ id: appointmentPayments.appointmentId }).from(appointmentPayments).where(eq(appointmentPayments.stripeSetupIntentId, si.id));
    if (used) return { ok: false, error: "Cette carte a déjà servi pour une réservation : recommencez l'étape de paiement." };
    const pm = await stripe()!.paymentMethods.retrieve(si.payment_method).catch(() => null);
    payment = { method: method === "none" ? "on_site" : method, status: "authorized", amountCents: price, stripeSetupIntentId: si.id, stripeCustomerId: typeof si.customer === "string" ? si.customer : null, stripePaymentMethodId: si.payment_method, cardBrand: pm?.card?.brand ?? null, cardLast4: pm?.card?.last4 ?? null };
  }
  const refundIfPaid = async () => {
    if (payment?.status === "paid" && payment.stripePaymentIntentId) await stripe()?.refunds.create({ payment_intent: payment.stripePaymentIntentId }).catch((e) => console.error("[paiement] remboursement après échec :", e));
  };

  // Revérification côté serveur : le créneau doit toujours être libre selon le moteur.
  const slots = await getAvailableSlots({ businessId: data.business.id, serviceId: service.id, memberId: v.memberId ?? undefined, days: [v.date] });
  const slot = (slots[v.date] ?? []).find((s) => s.time === v.time);
  if (!slot) {
    await refundIfPaid();
    return { ok: false, error: `Ce créneau n'est plus disponible. Choisissez-en un autre.${payment?.status === "paid" ? " Votre paiement a été remboursé." : ""}`, slotTaken: true };
  }
  const memberId = v.memberId ?? slot.memberIds[0]!;

  const fullName = `${v.firstName} ${v.lastName}`;
  // Client connecté (adresse vérifiée, même email que la réservation) : la fiche est rattachée à son compte.
  const session = await getSessionUser();
  const linkUserId = session?.user.emailVerifiedAt && session.user.email.toLowerCase() === v.email ? session.user.id : null;
  // Forfait gratuit : confirmation automatique jusqu'à 20 RDV en ligne par mois, ensuite « à confirmer » (rien n'est bloqué).
  const allowed = data.settings.autoConfirm ? await autoConfirmAllowed(data.business.id, data.business.timezone) : false;
  const status = data.settings.autoConfirm && allowed ? "confirmed" : "pending";
  if (data.settings.autoConfirm && !allowed) after(() => notifyAutoConfirmLimit(data.business.id, data.business.timezone));

  try {
    const created = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(customers).where(and(eq(customers.businessId, data.business.id), sql`lower(${customers.email}) = ${v.email}`));
      if (existing?.blockedAt) throw new BlockedError();
      let customerId = existing?.id;
      if (!customerId) {
        const [c] = await tx.insert(customers).values({ businessId: data.business.id, userId: linkUserId, firstName: v.firstName, lastName: v.lastName, fullName, email: v.email, phone: v.phone || null }).returning({ id: customers.id });
        customerId = c!.id;
      } else {
        const patch: { phone?: string; userId?: string } = {};
        if (!existing!.phone && v.phone) patch.phone = v.phone;
        if (!existing!.userId && linkUserId) patch.userId = linkUserId;
        if (Object.keys(patch).length) await tx.update(customers).set(patch).where(eq(customers.id, customerId));
      }

      const [appt] = await tx
        .insert(appointments)
        .values({
          businessId: data.business.id,
          status,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          memberId,
          serviceId: service.id,
          customerId,
          serviceName: service.name,
          serviceColor: service.color,
          contactName: fullName,
          contactEmail: v.email,
          locale: v.locale ?? "fr",
          contactPhone: v.phone || null,
          customerMessage: v.message || null,
          formAnswers: answers,
          policyConsent,
        })
        .returning({ id: appointments.id, token: appointments.manageToken });

      if (payment) await tx.insert(appointmentPayments).values({ appointmentId: appt!.id, ...payment });
      await tx.insert(activityLogs).values({ businessId: data.business.id, actorName: fullName, action: "appointment.online", description: `Réservation en ligne : ${service.name}, ${humanDateTime(v.date, v.time)}` });
      return appt!;
    });
    after(() => notifyBookingCreated(created.id, "online"));
    return { ok: true, token: created.token };
  } catch (error) {
    await refundIfPaid();
    if (error instanceof BlockedError) return { ok: false, error: "La réservation en ligne n'est pas disponible. Contactez directement l'établissement." };
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23P01" || e.cause?.code === "23P01") return { ok: false, error: "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisissez-en un autre.", slotTaken: true };
    throw error;
  }
}

class BlockedError extends Error {}

const waitlistSchema = z.object({
  slug: z.string().min(1).max(80),
  serviceId: z.uuid(),
  memberId: z.uuid().nullable(),
  date: isoDay,
  name: z.string().trim().min(1, "Indiquez votre nom.").max(120),
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  website: z.string().max(0).optional(),
  locale: z.enum(LOCALES).optional(),
});

/** « Me prévenir si une place se libère » sur un jour complet. */
export async function joinWaitlist(input: z.input<typeof waitlistSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rateLimit(`waitlist:${await ip()}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  const parsed = waitlistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const data = await getPublicBusiness(v.slug);
  if (!data?.settings?.waitlistEnabled || data.closed) return { ok: false, error: "La liste d'attente n'est pas disponible." };
  const service = data.services.find((s) => s.id === v.serviceId);
  if (!service) return { ok: false, error: "Prestation introuvable." };
  await db.insert(waitlistEntries).values({ businessId: data.business.id, serviceId: service.id, memberId: v.memberId && service.memberIds.includes(v.memberId) ? v.memberId : null, date: v.date, name: v.name, email: v.email, locale: v.locale ?? "fr" }).onConflictDoNothing();
  return { ok: true };
}

/**
 * Prépare le paiement côté Stripe : paiement immédiat (PaymentIntent) ou carte en garantie (SetupIntent, 0 € prélevé).
 * Le montant vient toujours de la base. Avec un compte Stripe Connect actif, l'argent va directement au pro.
 */
export async function startPayment(input: { slug: string; serviceId: string; email: string; name: string; mode: "pay" | "guarantee" }): Promise<{ ok: true; clientSecret: string } | { ok: false; error: string }> {
  if (!rateLimit(`pay:${await ip()}`, 20, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  const s = stripe();
  const data = await getPublicBusiness(String(input.slug));
  const email = z.email().safeParse(String(input.email ?? "").trim().toLowerCase());
  if (!s || !data || data.closed || !email.success) return { ok: false, error: "Paiement indisponible." };
  const service = data.services.find((x) => x.id === input.serviceId);
  if (!service?.priceCents) return { ok: false, error: "Cette prestation n'a pas de prix." };
  const [ps] = await db.select({ acct: paymentSettings.stripeAccountId, status: paymentSettings.stripeStatus }).from(paymentSettings).where(eq(paymentSettings.businessId, data.business.id));
  const destination = ps?.status === "active" && ps.acct ? ps.acct : null;
  const metadata = { businessId: data.business.id, serviceId: service.id };
  try {
    if (input.mode === "pay") {
      if (!data.payment.online) return { ok: false, error: "Paiement en ligne indisponible." };
      const pi = await s.paymentIntents.create({
        amount: service.priceCents,
        currency: "eur",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        description: `Réservation — ${service.name} (${data.business.name})`,
        receipt_email: email.data,
        metadata,
        ...(destination ? { transfer_data: { destination } } : {}),
      });
      return { ok: true, clientSecret: pi.client_secret! };
    }
    if (!data.payment.guarantee) return { ok: false, error: "Aucune garantie demandée." };
    const customer = await s.customers.create({ email: email.data, name: String(input.name ?? "").slice(0, 120) || undefined, metadata });
    const si = await s.setupIntents.create({ customer: customer.id, payment_method_types: ["card"], usage: "off_session", metadata });
    return { ok: true, clientSecret: si.client_secret! };
  } catch (e) {
    console.error("[paiement] préparation :", e);
    return { ok: false, error: "Le paiement n'a pas pu être préparé. Réessayez." };
  }
}
