"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, appointments, customers } from "@/db/schema";
import { getAvailableSlots } from "@/server/availability";
import { rateLimit } from "@/server/auth/rate-limit";
import { notifyBookingCreated } from "@/server/notifications";
import { checkIntake, getPublicBusiness } from "@/server/public";

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
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

export type PublicDay = { date: string; slots: { time: string; memberIds: string[] }[] };

/** Créneaux libres d'une prestation sur quelques jours (page publique, sans connexion). */
export async function getPublicSlots(slug: string, serviceId: string, memberId: string | null, fromDay: string, count = 7): Promise<PublicDay[]> {
  if (!rateLimit(`slots:${await ip()}`, 120, 60_000).ok) return [];
  const parsed = z.object({ serviceId: z.uuid(), memberId: z.uuid().nullable(), fromDay: isoDay, count: z.number().int().min(1).max(14) }).safeParse({ serviceId, memberId, fromDay, count });
  if (!parsed.success) return [];
  const data = await getPublicBusiness(slug);
  if (!data || data.business.pausedAt) return [];
  const service = data.services.find((s) => s.id === serviceId);
  if (!service || (memberId && !service.memberIds.includes(memberId))) return [];

  const days = nextDays(fromDay, count);
  const slots = await getAvailableSlots({ businessId: data.business.id, serviceId, memberId: memberId ?? undefined, days });
  return days.map((date) => ({ date, slots: (slots[date] ?? []).map((s) => ({ time: s.time, memberIds: s.memberIds })) }));
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
});

export type BookingResult = { ok: true; token: string } | { ok: false; error: string; fieldErrors?: Record<string, string>; slotTaken?: boolean };

export async function createPublicBooking(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const clientIp = await ip();
  if (!rateLimit(`book:${clientIp}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de réservations depuis cette connexion. Réessayez plus tard ou appelez l'établissement." };

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;

  const data = await getPublicBusiness(v.slug);
  if (!data || !data.settings) return { ok: false, error: "Établissement introuvable." };
  if (data.business.pausedAt) return { ok: false, error: "Cet établissement ne prend pas de réservation en ligne pour le moment." };
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

  // Revérification côté serveur : le créneau doit toujours être libre selon le moteur.
  const slots = await getAvailableSlots({ businessId: data.business.id, serviceId: service.id, memberId: v.memberId ?? undefined, days: [v.date] });
  const slot = (slots[v.date] ?? []).find((s) => s.time === v.time);
  if (!slot) return { ok: false, error: "Ce créneau n'est plus disponible. Choisissez-en un autre.", slotTaken: true };
  const memberId = v.memberId ?? slot.memberIds[0]!;

  const fullName = `${v.firstName} ${v.lastName}`;
  const status = data.settings.autoConfirm ? "confirmed" : "pending";

  try {
    const created = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(customers).where(and(eq(customers.businessId, data.business.id), sql`lower(${customers.email}) = ${v.email}`));
      if (existing?.blockedAt) throw new BlockedError();
      let customerId = existing?.id;
      if (!customerId) {
        const [c] = await tx.insert(customers).values({ businessId: data.business.id, firstName: v.firstName, lastName: v.lastName, fullName, email: v.email, phone: v.phone || null }).returning({ id: customers.id });
        customerId = c!.id;
      } else if (!existing!.phone && v.phone) {
        await tx.update(customers).set({ phone: v.phone }).where(eq(customers.id, customerId));
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
          contactPhone: v.phone || null,
          customerMessage: v.message || null,
          formAnswers: answers,
        })
        .returning({ id: appointments.id, token: appointments.manageToken });

      await tx.insert(activityLogs).values({ businessId: data.business.id, actorName: fullName, action: "appointment.online", description: `Réservation en ligne : ${service.name}, ${v.date} ${v.time}` });
      return appt!;
    });
    after(() => notifyBookingCreated(created.id, "online"));
    return { ok: true, token: created.token };
  } catch (error) {
    if (error instanceof BlockedError) return { ok: false, error: "La réservation en ligne n'est pas disponible. Contactez directement l'établissement." };
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23P01" || e.cause?.code === "23P01") return { ok: false, error: "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisissez-en un autre.", slotTaken: true };
    throw error;
  }
}

class BlockedError extends Error {}
