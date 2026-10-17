"use server";

import { TZDate } from "@date-fns/tz";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, appointments, bookingSettings, customers, groupSessions, members, services } from "@/db/schema";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { notifyBookingCreated, notifyCancelledByBusiness } from "@/server/notifications";
import { listPublicSessions, type PublicSession } from "@/server/group-sessions";
import { getPublicBusiness } from "@/server/public";

export type SessionFormState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
  memberId: z.string(),
  repeatWeeks: z.coerce.number().int().min(1).max(52),
  capacity: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1, "Au moins 1 place.").max(500).nullable()),
});

/** Planifie une séance, ou une série hebdomadaire (même jour, même heure, N semaines). */
export async function createSessions(serviceId: string, _prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const ctx = await requireContext("groupSessions.manage");
  const sid = z.uuid().parse(serviceId);
  const [service] = await db.select().from(services).where(and(eq(services.id, sid), eq(services.businessId, ctx.business.id), eq(services.kind, "group")));
  if (!service) return { error: "Prestation introuvable." };

  const parsed = sessionSchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    memberId: String(formData.get("memberId") ?? ""),
    repeatWeeks: formData.get("repeat") === "on" ? formData.get("repeatWeeks") : 1,
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;

  let memberId: string | null = null;
  if (v.memberId) {
    const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, v.memberId), eq(members.businessId, ctx.business.id)));
    if (!m) return { error: "Membre introuvable." };
    memberId = m.id;
  }

  const [y, mo, d] = v.date.split("-").map(Number) as [number, number, number];
  const [h, mi] = v.time.split(":").map(Number) as [number, number];
  const rows = Array.from({ length: v.repeatWeeks }, (_, week) => {
    // Construit dans le fuseau de l'établissement : l'heure reste 18:00 même après le changement d'heure.
    const startsAt = new Date(new TZDate(y, mo - 1, d + week * 7, h, mi, 0, ctx.business.timezone).getTime());
    return { serviceId: service.id, memberId, startsAt, endsAt: new Date(startsAt.getTime() + service.durationMin * 60000), capacity: v.capacity === service.capacity ? null : v.capacity };
  });
  if (rows[0]!.startsAt < new Date()) return { error: "Vérifiez les champs indiqués.", fieldErrors: { date: "Cette date est déjà passée." } };

  await db.insert(groupSessions).values(rows);
  await db.insert(activityLogs).values({
    businessId: ctx.business.id,
    userId: ctx.user.id,
    actorName: ctx.user.name,
    action: "groupSession.create",
    description: rows.length > 1 ? `${rows.length} séances planifiées : ${service.name}` : `Séance planifiée : ${service.name}, ${v.date} ${v.time}`,
  });
  revalidatePath("/app", "layout");
  return { ok: true, message: rows.length > 1 ? `${rows.length} séances ajoutées.` : "Séance ajoutée." };
}

/** Annule une séance et toutes ses inscriptions ; chaque participant est prévenu par email. */
export async function cancelSession(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("groupSessions.manage");
  const id = z.uuid().parse(sessionId);
  const result = await db.transaction(async (tx) => {
    const [session] = await tx
      .select({ id: groupSessions.id, startsAt: groupSessions.startsAt, serviceName: services.name })
      .from(groupSessions)
      .innerJoin(services, eq(services.id, groupSessions.serviceId))
      .where(and(eq(groupSessions.id, id), eq(services.businessId, ctx.business.id), isNull(groupSessions.cancelledAt)));
    if (!session) return null;
    const now = new Date();
    await tx.update(groupSessions).set({ cancelledAt: now }).where(eq(groupSessions.id, id));
    const cancelled = await tx
      .update(appointments)
      .set({ status: "cancelled", cancelledAt: now })
      .where(and(eq(appointments.groupSessionId, id), ne(appointments.status, "cancelled")))
      .returning({ id: appointments.id });
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "groupSession.cancel", description: `Séance annulée : ${session.serviceName} (${cancelled.length} participant${cancelled.length > 1 ? "s" : ""} prévenu${cancelled.length > 1 ? "s" : ""})` });
    return { session, cancelled };
  });
  if (!result) return { ok: false, error: "Séance introuvable ou déjà annulée." };
  if (result.session.startsAt > new Date()) after(async () => { for (const a of result.cancelled) await notifyCancelledByBusiness(a.id); });
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- Réservation publique */

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

const bookingSchema = z.object({
  slug: z.string().min(1).max(80),
  sessionId: z.uuid(),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(60),
  lastName: z.string().trim().min(1, "Indiquez votre nom.").max(60),
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  phone: z.string().trim().max(40),
  message: z.string().trim().max(1000),
  answers: z.record(z.string(), z.string().max(1000)),
  website: z.string().max(0).optional(),
});

export type GroupBookingResult = { ok: true; token: string } | { ok: false; error: string; fieldErrors?: Record<string, string>; full?: boolean };

class BookingError extends Error {
  constructor(message: string, readonly full = false) {
    super(message);
  }
}

/**
 * Inscription à une séance. La ligne de la séance est verrouillée (FOR UPDATE)
 * pendant le comptage : deux inscriptions simultanées ne peuvent pas dépasser la capacité.
 * Les inscriptions aux cours sont confirmées directement (pas de demande à valider).
 */
export async function bookGroupSession(input: z.input<typeof bookingSchema>): Promise<GroupBookingResult> {
  if (!rateLimit(`book:${await ip()}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de réservations depuis cette connexion. Réessayez plus tard ou appelez l'établissement." };
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
  if (data.settings.phoneRequired && v.phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: { phone: "Indiquez un numéro de téléphone." } };

  const answers: { question: string; answer: string }[] = [];
  for (const q of data.questions) {
    const a = (v.answers[q.id] ?? "").trim();
    if (q.isRequired && !a) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: { [`q_${q.id}`]: "Réponse obligatoire." } };
    if (a && q.type === "choice" && !q.options.includes(a)) return { ok: false, error: "Réponse invalide." };
    if (a && q.type === "yes_no" && !["Oui", "Non"].includes(a)) return { ok: false, error: "Réponse invalide." };
    if (a) answers.push({ question: q.label, answer: a });
  }
  const [rules] = await db.select({ minLeadMin: bookingSettings.minLeadMin }).from(bookingSettings).where(eq(bookingSettings.businessId, data.business.id));
  const fullName = `${v.firstName} ${v.lastName}`;

  try {
    const created = await db.transaction(async (tx) => {
      const [session] = await tx
        .select({ id: groupSessions.id, startsAt: groupSessions.startsAt, endsAt: groupSessions.endsAt, memberId: groupSessions.memberId, capacity: groupSessions.capacity, service: services })
        .from(groupSessions)
        .innerJoin(services, eq(services.id, groupSessions.serviceId))
        .where(and(eq(groupSessions.id, v.sessionId), eq(services.businessId, data.business.id), eq(services.isActive, true), isNull(groupSessions.cancelledAt)))
        .for("update", { of: groupSessions });
      if (!session || !data.services.some((s) => s.id === session.service.id)) throw new BookingError("Cette séance n'est plus disponible.", true);
      const lead = (rules?.minLeadMin ?? 0) * 60000;
      if (session.startsAt.getTime() - lead < Date.now()) throw new BookingError("Les inscriptions à cette séance sont closes.", true);

      const [existing] = await tx.select().from(customers).where(and(eq(customers.businessId, data.business.id), sql`lower(${customers.email}) = ${v.email}`));
      if (existing?.blockedAt) throw new BookingError("La réservation en ligne n'est pas disponible. Contactez directement l'établissement.");

      const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.groupSessionId, session.id), ne(appointments.status, "cancelled")));
      const cap = session.capacity ?? session.service.capacity;
      if (cap != null && n >= cap) throw new BookingError("Cette séance est complète. Choisissez-en une autre.", true);
      if (existing) {
        const [dup] = await tx.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.groupSessionId, session.id), eq(appointments.customerId, existing.id), ne(appointments.status, "cancelled")));
        if (dup) throw new BookingError("Vous êtes déjà inscrit(e) à cette séance.");
      }

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
          status: "confirmed",
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          memberId: session.memberId,
          serviceId: session.service.id,
          groupSessionId: session.id,
          customerId,
          serviceName: session.service.name,
          serviceColor: session.service.color,
          contactName: fullName,
          contactEmail: v.email,
          contactPhone: v.phone || null,
          customerMessage: v.message || null,
          formAnswers: answers,
        })
        .returning({ id: appointments.id, token: appointments.manageToken });
      await tx.insert(activityLogs).values({ businessId: data.business.id, actorName: fullName, action: "groupSession.book", description: `Inscription en ligne : ${session.service.name}` });
      return appt!;
    });
    after(() => notifyBookingCreated(created.id, "online"));
    return { ok: true, token: created.token };
  } catch (error) {
    if (error instanceof BookingError) return { ok: false, error: error.message, full: error.full };
    throw error;
  }
}

/** Séances à venir d'un cours collectif (page publique). */
export async function getPublicSessions(slug: string, serviceId: string): Promise<PublicSession[]> {
  if (!rateLimit(`slots:${await ip()}`, 120, 60_000).ok) return [];
  const sid = z.uuid().safeParse(serviceId);
  if (!sid.success) return [];
  const data = await getPublicBusiness(slug);
  if (!data || !data.settings || data.business.pausedAt) return [];
  const service = data.services.find((s) => s.id === sid.data && s.kind === "group");
  if (!service) return [];
  const now = Date.now();
  const from = new Date(now + (data.settings.minLeadMin ?? 0) * 60000);
  const to = data.settings.horizonDays != null ? new Date(now + data.settings.horizonDays * 86400000) : null;
  return (await listPublicSessions([service.id], { from, to }))[service.id] ?? [];
}
