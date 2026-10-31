"use server";

import { LOCALES } from "@/i18n/config";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { paymentSettings, waitlistEntries } from "@/db/schema";
import { stripe } from "@/server/payments";
import { getAvailableSlots } from "@/server/availability";
import { rateLimit } from "@/server/auth/rate-limit";
import { getPublicBusiness } from "@/server/public";
import { bookPublic, type BookingInput, type BookingResult } from "@/server/booking-core";
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

export type { BookingResult } from "@/server/booking-core";

/** Réservation depuis la page publique (ou le widget du site du pro). */
export async function createPublicBooking(input: BookingInput): Promise<BookingResult> {
  return bookPublic(input, { ip: await ip(), source: "web" });
}

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
