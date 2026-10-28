"use server";

import { LOCALES } from "@/i18n/config";

import { TZDate } from "@date-fns/tz";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, appointments, bookingSettings, customers, groupSessions, members, services } from "@/db/schema";
import { isOccurrence, parseVirtualSessionId } from "@/lib/booking/recurrence";
import { parseQuickTime } from "@/lib/time-input";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { listPublicSessions, materializeSession, type PublicSession } from "@/server/group-sessions";
import { notifyBookingCreated, notifyCancelledByBusiness } from "@/server/notifications";
import { checkIntake, getPublicBusiness } from "@/server/public";
import { clientIp } from "@/lib/client-ip";

export type SessionFormState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

const at = (day: string, hhmm: string, tz: string) => {
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, tz).getTime());
};

async function ownGroupService(businessId: string, serviceId: string) {
  const [s] = await db.select().from(services).where(and(eq(services.id, z.uuid().parse(serviceId)), eq(services.businessId, businessId), eq(services.kind, "group")));
  return s ?? null;
}

/* ───────────────────────────── Planification (pro) ───────────────────────────── */

const recurrenceSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string(),
});

/** Cours récurrent : « tous les lundis et jeudis à 18:00 », sans date de fin. Jours vides = pas de récurrence. */
export async function saveRecurrence(serviceId: string, input: z.input<typeof recurrenceSchema>): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("groupSessions.manage", { app: "rdv" });
  const svc = await ownGroupService(ctx.business.id, serviceId);
  if (!svc) return { ok: false, error: "Cours introuvable." };
  const parsed = recurrenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Jours ou heure invalides." };
  const time = parseQuickTime(parsed.data.startTime);
  if (parsed.data.weekdays.length && !time) return { ok: false, error: "Heure invalide (ex. 18 ou 18h30)." };
  const recurrence = parsed.data.weekdays.length ? { weekdays: [...new Set(parsed.data.weekdays)].sort(), startTime: time! } : null;
  await db.update(services).set({ recurrence }).where(eq(services.id, svc.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "groupSession.recurrence", description: recurrence ? `Cours récurrent réglé : ${svc.name}` : `Récurrence arrêtée : ${svc.name}` });
  revalidatePath("/app", "layout");
  return { ok: true };
}

const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  start: z.string(),
  end: z.string(),
  memberId: z.string(),
  repeatWeeks: z.coerce.number().int().min(1).max(52),
  capacity: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1, "Au moins 1 place.").max(500).nullable()),
});

/** Date ponctuelle (heure de début et de fin libres), éventuellement répétée N semaines. */
export async function createSessions(serviceId: string, _prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const ctx = await requireContext("groupSessions.manage", { app: "rdv" });
  const service = await ownGroupService(ctx.business.id, serviceId);
  if (!service) return { error: "Cours introuvable." };

  const parsed = sessionSchema.safeParse({
    date: formData.get("date"),
    start: String(formData.get("start") ?? ""),
    end: String(formData.get("end") ?? ""),
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
  const start = parseQuickTime(v.start);
  const end = parseQuickTime(v.end);
  if (!start) return { error: "Vérifiez les champs indiqués.", fieldErrors: { start: "Heure invalide." } };
  if (!end || end <= start) return { error: "Vérifiez les champs indiqués.", fieldErrors: { end: "L'heure de fin doit être après le début." } };

  let memberId: string | null = null;
  if (v.memberId) {
    const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, v.memberId), eq(members.businessId, ctx.business.id)));
    if (!m) return { error: "Membre introuvable." };
    memberId = m.id;
  }

  const tz = ctx.business.timezone;
  const rows = Array.from({ length: v.repeatWeeks }, (_, week) => {
    const d = new Date(v.date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + week * 7);
    const day = d.toISOString().slice(0, 10);
    // Construit dans le fuseau de l'établissement : l'heure reste la même après le changement d'heure.
    return { serviceId: service.id, memberId, startsAt: at(day, start, tz), endsAt: at(day, end, tz), capacity: v.capacity === service.capacity ? null : v.capacity };
  });
  if (rows[0]!.startsAt < new Date()) return { error: "Vérifiez les champs indiqués.", fieldErrors: { date: "Cette date est déjà passée." } };

  const created = await db.insert(groupSessions).values(rows).onConflictDoNothing().returning({ id: groupSessions.id });
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "groupSession.create", description: created.length > 1 ? `${created.length} séances planifiées : ${service.name}` : `Séance planifiée : ${service.name}, ${v.date} ${start}` });
  revalidatePath("/app", "layout");
  if (created.length < rows.length) return { ok: true, message: `${created.length} séance${created.length > 1 ? "s" : ""} ajoutée${created.length > 1 ? "s" : ""} (les autres existaient déjà à cet horaire).` };
  return { ok: true, message: rows.length > 1 ? `${rows.length} séances ajoutées.` : "Séance ajoutée." };
}

/** Annule une séance (récurrente ou ponctuelle) et toutes ses inscriptions ; chaque participant est prévenu. */
export async function cancelSession(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("groupSessions.manage", { app: "rdv" });
  const virtual = parseVirtualSessionId(sessionId);
  const result = await db.transaction(async (tx) => {
    let id = sessionId;
    if (virtual) {
      const svc = await ownGroupService(ctx.business.id, virtual.serviceId);
      if (!svc?.recurrence || !isOccurrence(svc.recurrence, virtual.startsAt, ctx.business.timezone)) return null;
      id = await materializeSession(tx, svc.id, virtual.startsAt, new Date(virtual.startsAt.getTime() + svc.durationMin * 60000), null);
    } else z.uuid().parse(id);
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
    return { session, cancelled, id };
  });
  if (!result) return { ok: false, error: "Séance introuvable ou déjà annulée." };
  if (result.session.startsAt > new Date()) after(async () => { for (const a of result.cancelled) await notifyCancelledByBusiness(a.id); });
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Rétablit une séance annulée (les inscriptions annulées ne sont pas restaurées). */
export async function restoreSession(sessionId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("groupSessions.manage", { app: "rdv" });
  const id = z.uuid().parse(sessionId);
  const [own] = await db.select({ id: groupSessions.id }).from(groupSessions).innerJoin(services, eq(services.id, groupSessions.serviceId)).where(and(eq(groupSessions.id, id), eq(services.businessId, ctx.business.id)));
  if (!own) return { ok: false };
  await db.update(groupSessions).set({ cancelledAt: null }).where(eq(groupSessions.id, id));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ───────────────────────────── Réservation publique ───────────────────────────── */

async function ip() {
  const h = await headers();
  return (clientIp(h) ?? "unknown");
}

const bookingSchema = z.object({
  slug: z.string().min(1).max(80),
  sessionId: z.string().min(1).max(80),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(60),
  lastName: z.string().trim().min(1, "Indiquez votre nom.").max(60),
  email: z.email({ message: "Adresse email invalide." }).transform((e) => e.toLowerCase()),
  phone: z.string().trim().max(40),
  message: z.string().trim().max(1000),
  answers: z.record(z.string(), z.string().max(1000)),
  /** Réponses au questionnaire d'orientation : id de question → id de réponse. */
  intake: z.record(z.string(), z.string().max(64)).optional(),
  website: z.string().max(0).optional(),
  locale: z.enum(LOCALES).optional(),
});

export type GroupBookingResult = { ok: true; token: string } | { ok: false; error: string; fieldErrors?: Record<string, string>; full?: boolean };

class BookingError extends Error {
  constructor(message: string, readonly full = false) {
    super(message);
  }
}

/**
 * Inscription à une séance. La ligne de la séance est verrouillée (FOR UPDATE) pendant le comptage :
 * deux inscriptions simultanées ne peuvent pas dépasser la capacité. Une séance récurrente est
 * enregistrée à cette occasion. Les inscriptions aux cours sont confirmées directement.
 */
export async function bookGroupSession(input: z.input<typeof bookingSchema>): Promise<GroupBookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  if (!rateLimit(`book:${await ip()}:${parsed.data.slug}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de réservations depuis cette connexion. Réessayez plus tard ou appelez l'établissement." };
  const v = parsed.data;
  const data = await getPublicBusiness(v.slug);
  if (!data || !data.settings) return { ok: false, error: "Établissement introuvable." };
  if (data.closed) return { ok: false, error: "Cet établissement ne prend pas de réservation en ligne pour le moment." };
  if (data.settings.phoneRequired && v.phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: { phone: "Indiquez un numéro de téléphone." } };

  const answers: { question: string; answer: string }[] = [];
  for (const q of data.questions) {
    const a = (v.answers[q.id] ?? "").trim();
    if (q.isRequired && !a) return { ok: false, error: "Vérifiez les champs indiqués.", fieldErrors: { [`q_${q.id}`]: "Réponse obligatoire." } };
    if (a && q.type === "choice" && !q.options.includes(a)) return { ok: false, error: "Réponse invalide." };
    if (a && q.type === "yes_no" && !["Oui", "Non"].includes(a)) return { ok: false, error: "Réponse invalide." };
    if (a) answers.push({ question: q.label, answer: a });
  }
  const [rules] = await db.select({ minLeadMin: bookingSettings.minLeadMin, horizonDays: bookingSettings.horizonDays }).from(bookingSettings).where(eq(bookingSettings.businessId, data.business.id));
  const fullName = `${v.firstName} ${v.lastName}`;
  const tz = data.business.timezone;

  try {
    const created = await db.transaction(async (tx) => {
      let sessionId = v.sessionId;
      const virtual = parseVirtualSessionId(sessionId);
      if (virtual) {
        const [svc] = await tx.select().from(services).where(and(eq(services.id, virtual.serviceId), eq(services.businessId, data.business.id), eq(services.kind, "group"), eq(services.isActive, true)));
        if (!svc?.recurrence || !isOccurrence(svc.recurrence, virtual.startsAt, tz)) throw new BookingError("Cette séance n'est plus disponible.", true);
        if (rules?.horizonDays && virtual.startsAt.getTime() > Date.now() + rules.horizonDays * 86400000) throw new BookingError("Cette séance n'est pas encore ouverte aux inscriptions.", true);
        sessionId = await materializeSession(tx, svc.id, virtual.startsAt, new Date(virtual.startsAt.getTime() + svc.durationMin * 60000), null);
      } else if (!z.uuid().safeParse(sessionId).success) throw new BookingError("Cette séance n'est plus disponible.", true);

      const [session] = await tx
        .select({ id: groupSessions.id, startsAt: groupSessions.startsAt, endsAt: groupSessions.endsAt, memberId: groupSessions.memberId, capacity: groupSessions.capacity, service: services })
        .from(groupSessions)
        .innerJoin(services, eq(services.id, groupSessions.serviceId))
        .where(and(eq(groupSessions.id, sessionId), eq(services.businessId, data.business.id), eq(services.isActive, true), isNull(groupSessions.cancelledAt)))
        .for("update", { of: groupSessions });
      if (!session || !data.services.some((s) => s.id === session.service.id)) throw new BookingError("Cette séance n'est plus disponible.", true);
      const intake = checkIntake(data, session.service.id, v.intake ?? {});
      if (!intake.ok) throw new BookingError("Ce cours ne correspond pas à vos réponses.");
      answers.unshift(...intake.lines);
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
          locale: v.locale ?? "fr",
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
  if (!data || !data.settings || data.closed) return [];
  if (!data.services.some((s) => s.id === sid.data && s.kind === "group")) return [];
  const now = Date.now();
  const from = new Date(now + (data.settings.minLeadMin ?? 0) * 60000);
  // Sans horizon réglé, on montre 8 semaines de séances récurrentes.
  const to = new Date(now + (data.settings.horizonDays ?? 56) * 86400000);
  return listPublicSessions(data.business.id, sid.data, { from, to }, data.business.timezone);
}
