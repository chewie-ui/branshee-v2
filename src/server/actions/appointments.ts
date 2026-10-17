"use server";

import { TZDate } from "@date-fns/tz";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, appointmentPayments, appointments, bookingSettings, customers, members, serviceMembers, services } from "@/db/schema";
import { parseQuickTime } from "@/lib/time-input";
import { getAvailableSlots } from "@/server/availability";
import { requireContext, type AppContext } from "@/server/context";
import { syncAppointmentToGoogle } from "@/server/google";
import { applyBusinessCancellation, applyNoShow, reviewPenalty } from "@/server/payments";
import { notifyBookingCreated, notifyCancelledByBusiness, notifyRequestDecision, notifyRescheduled, sendManualReminder } from "@/server/notifications";

const idSchema = z.uuid();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

/** Erreur prévue, dont le message peut être montré tel quel à l'utilisateur. */
class UserError extends Error {}

/** 23P01 = contrainte anti-chevauchement : un autre RDV confirmé occupe déjà ce créneau pour ce membre. */
const isOverlap = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code === "23P01" || e.cause?.code === "23P01";
};

const at = (day: string, hhmm: string, tz: string) => {
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, tz).getTime());
};

async function log(ctx: AppContext, action: string, description: string) {
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action, description });
}

async function allowsOverbooking(businessId: string) {
  const [s] = await db.select({ v: bookingSettings.allowOverbooking }).from(bookingSettings).where(eq(bookingSettings.businessId, businessId));
  return s?.v ?? false;
}

/* ───────────────────────────── Demandes en attente ───────────────────────────── */

export async function confirmRequest(rawId: string) {
  const ctx = await requireContext("appointments.manage");
  const id = idSchema.parse(rawId);
  let updated: { contactName: string | null }[];
  try {
    updated = await db
      .update(appointments)
      .set({ status: "confirmed", cancelledAt: null })
      .where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id), eq(appointments.status, "pending")))
      .returning({ contactName: appointments.contactName });
  } catch (error) {
    if (isOverlap(error)) return { ok: false as const, error: "Ce créneau est déjà pris par un autre rendez-vous confirmé." };
    throw error;
  }
  if (updated.length === 0) return { ok: false as const, error: "Cette demande a déjà été traitée." };
  await log(ctx, "appointment.confirm", `Demande confirmée : ${updated[0]!.contactName ?? "client"}`);
  after(() => notifyRequestDecision(id, true));
  revalidatePath("/app", "layout");
  return { ok: true as const };
}

/**
 * Refuse une demande. Le motif (facultatif) est envoyé au client.
 * `silent` : pour une demande expirée, on libère le créneau sans écrire au client.
 */
export async function refuseRequest(rawId: string, reason = "", silent = false) {
  const ctx = await requireContext("appointments.manage");
  const id = idSchema.parse(rawId);
  const motive = reason.trim().slice(0, 500);
  const updated = await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id), eq(appointments.status, "pending")))
    .returning({ contactName: appointments.contactName });
  if (updated.length === 0) return { ok: false as const, error: "Cette demande a déjà été traitée." };
  await log(ctx, "appointment.refuse", `${silent ? "Demande expirée libérée" : "Demande refusée"} : ${updated[0]!.contactName ?? "client"}${motive ? ` (motif : ${motive})` : ""}`);
  after(() => applyBusinessCancellation(id));
  if (!silent) after(() => notifyRequestDecision(id, false, motive || null));
  revalidatePath("/app", "layout");
  return { ok: true as const };
}

/* ───────────────────────────── Création ───────────────────────────── */

const createSchema = z
  .object({
    serviceId: z.union([z.uuid(), z.literal("")]),
    /** "" = le premier membre libre. */
    memberId: z.union([z.uuid(), z.literal("")]),
    slots: z.array(z.object({ date: isoDay, time: z.string() })).min(1, "Ajoutez au moins une date.").max(20, "20 dates maximum à la fois."),
    durationMin: z.coerce.number().int().min(5, "Durée minimum : 5 min.").max(720, "Durée maximum : 12 h."),
    customerId: z.union([z.uuid(), z.literal("")]),
    newFirstName: z.string().trim().max(60),
    newLastName: z.string().trim().max(60),
    newEmail: z.union([z.email({ message: "Email invalide." }), z.literal("")]),
    newPhone: z.string().trim().max(40),
    note: z.string().trim().max(1000),
    notify: z.boolean(),
  })
  .refine((v) => v.customerId !== "" || v.newFirstName.length + v.newLastName.length > 1, { message: "Choisissez un client ou saisissez un nom.", path: ["newFirstName"] });

export type CreateAppointmentState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createAppointment(_prev: CreateAppointmentState, formData: FormData): Promise<CreateAppointmentState> {
  const ctx = await requireContext("appointments.manage");
  const bid = ctx.business.id;
  const tz = ctx.business.timezone;
  let slotsRaw: unknown = [];
  try {
    slotsRaw = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    /* champ illisible : la validation renverra l'erreur */
  }
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = createSchema.safeParse({
    serviceId: str("serviceId"),
    memberId: str("memberId"),
    slots: slotsRaw,
    durationMin: formData.get("durationMin"),
    customerId: str("customerId"),
    newFirstName: str("newFirstName"),
    newLastName: str("newLastName"),
    newEmail: str("newEmail").trim().toLowerCase(),
    newPhone: str("newPhone"),
    note: str("note"),
    notify: formData.get("notify") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;

  const times = v.slots.map((s) => ({ date: s.date, time: parseQuickTime(s.time) }));
  if (times.some((t) => !t.time)) return { error: "Vérifiez les champs indiqués.", fieldErrors: { slots: "Une heure n'est pas valide (ex. 9, 0930 ou 14h30)." } };

  const service = v.serviceId ? (await db.select().from(services).where(and(eq(services.id, v.serviceId), eq(services.businessId, bid))))[0] : null;
  if (v.serviceId && !service) return { error: "Prestation introuvable." };

  // Membres possibles : celui choisi, sinon ceux qui réalisent la prestation (ou toute l'équipe réservable).
  const team = await db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, bid), eq(members.status, "active"), eq(members.isActive, true), eq(members.isBookable, true)));
  let candidates = team;
  if (v.memberId) candidates = team.filter((m) => m.id === v.memberId);
  else if (service) {
    const restricted = (await db.select({ id: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, service.id))).map((r) => r.id);
    if (restricted.length) candidates = team.filter((m) => restricted.includes(m.id));
  }
  if (candidates.length === 0) return { error: "Aucun membre de l'équipe ne peut prendre ce rendez-vous." };
  const overbook = await allowsOverbooking(bid);

  const createdIds: string[] = [];
  let firstDay = times[0]!.date;
  try {
    await db.transaction(async (tx) => {
      let customerId = v.customerId || null;
      const fullName = `${v.newFirstName} ${v.newLastName}`.trim();
      let contact = { name: fullName, email: v.newEmail || null, phone: v.newPhone || null };
      if (customerId) {
        const [c] = await tx.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, bid)));
        if (!c) throw new UserError("Client introuvable.");
        contact = { name: c.fullName, email: c.email, phone: c.phone };
      } else {
        const [existing] = v.newEmail ? await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, bid), sql`lower(${customers.email}) = ${v.newEmail}`)) : [];
        if (existing) customerId = existing.id;
        else {
          const [c] = await tx
            .insert(customers)
            .values({ businessId: bid, firstName: v.newFirstName || null, lastName: v.newLastName || null, fullName, email: v.newEmail || null, phone: v.newPhone || null, createdManually: true })
            .returning({ id: customers.id });
          customerId = c!.id;
        }
      }

      for (const [i, t] of times.entries()) {
        const startsAt = at(t.date, t.time!, tz);
        const endsAt = new Date(startsAt.getTime() + v.durationMin * 60000);
        let placed = false;
        // Membre « au hasard » : on essaie chacun ; un point de sauvegarde annule l'essai si le créneau est pris.
        for (const m of candidates) {
          try {
            const created = await tx.transaction(async (sp) => {
              const [row] = await sp
                .insert(appointments)
                .values({
                  businessId: bid,
                  status: "confirmed",
                  startsAt,
                  endsAt,
                  memberId: m.id,
                  serviceId: service?.id ?? null,
                  customerId,
                  serviceName: service?.name ?? null,
                  serviceColor: service?.color ?? null,
                  contactName: contact.name,
                  contactEmail: contact.email,
                  contactPhone: contact.phone,
                  internalNote: v.note || null,
                  overbooked: overbook,
                  createdById: ctx.user.id,
                })
                .returning({ id: appointments.id });
              return row!.id;
            });
            createdIds.push(created);
            placed = true;
            break;
          } catch (error) {
            if (!isOverlap(error)) throw error;
          }
        }
        if (!placed) {
          const who = candidates.length === 1 ? candidates[0]!.name : "Toute l'équipe";
          throw new UserError(`${who} est déjà occupé${candidates.length === 1 ? "" : "e"} le ${t.date.split("-").reverse().join("/")} à ${t.time}${times.length > 1 ? ` (date n° ${i + 1})` : ""}. Rien n'a été créé.`);
        }
      }
      firstDay = times.map((t) => t.date).sort()[0]!;
      await tx.insert(activityLogs).values({ businessId: bid, userId: ctx.user.id, actorName: ctx.user.name, action: "appointment.create", description: times.length > 1 ? `${times.length} rendez-vous créés : ${contact.name}` : `Rendez-vous créé : ${contact.name}, ${t0(times)}` });
    });
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }

  if (v.notify) for (const id of createdIds) after(() => notifyBookingCreated(id, "pro"));
  revalidatePath("/app", "layout");
  redirect(`/app/agenda?semaine=${firstDay}`);
}

const t0 = (times: { date: string; time: string | null }[]) => `${times[0]!.date.split("-").reverse().join("/")} ${times[0]!.time}`;

/** Créneaux libres pour aider à choisir l'heure dans le formulaire de création. */
export async function fetchFreeSlots(serviceId: string, memberId: string, date: string): Promise<string[]> {
  const ctx = await requireContext("appointments.manage");
  const parsed = z.object({ serviceId: z.uuid(), memberId: z.union([z.uuid(), z.literal("")]), date: isoDay }).safeParse({ serviceId, memberId, date });
  if (!parsed.success) return [];
  // Côté pro, on ignore le délai minimum et l'horizon : ils ne concernent que la réservation en ligne.
  const slots = await getAvailableSlots({ businessId: ctx.business.id, serviceId, memberId: memberId || undefined, days: [date], ignoreOnlineRules: true });
  return (slots[date] ?? []).map((s) => s.time);
}

/* ───────────────────────────── Blocages (absences) ───────────────────────────── */

const blockSchema = z.object({
  date: isoDay,
  start: z.string(),
  end: z.string(),
  /** "" = tout l'établissement. */
  memberId: z.union([z.uuid(), z.literal("")]),
  note: z.string().trim().max(200),
});

export type BlockResult = { ok: true } | { ok: false; error: string };

/** Crée (blockId null) ou modifie un créneau bloqué : pause, rendez-vous perso, absence… */
export async function saveBlock(blockId: string | null, input: z.input<typeof blockSchema>): Promise<BlockResult> {
  const ctx = await requireContext("appointments.manage");
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const start = parseQuickTime(v.start);
  const end = parseQuickTime(v.end);
  if (!start || !end) return { ok: false, error: "Heure invalide (ex. 9, 0930 ou 14h30)." };
  if (end <= start) return { ok: false, error: "L'heure de fin doit être après l'heure de début." };
  if (v.memberId) {
    const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, v.memberId), eq(members.businessId, ctx.business.id)));
    if (!m) return { ok: false, error: "Membre introuvable." };
  }
  const values = {
    kind: "block" as const,
    status: "confirmed" as const,
    startsAt: at(v.date, start, ctx.business.timezone),
    endsAt: at(v.date, end, ctx.business.timezone),
    memberId: v.memberId || null,
    internalNote: v.note || null,
    // Un blocage peut volontairement recouvrir des RDV existants : il ne doit pas buter sur la contrainte.
    overbooked: true,
  };
  if (blockId) {
    const updated = await db.update(appointments).set(values).where(and(eq(appointments.id, idSchema.parse(blockId)), eq(appointments.businessId, ctx.business.id), eq(appointments.kind, "block"))).returning({ id: appointments.id });
    if (!updated.length) return { ok: false, error: "Blocage introuvable." };
  } else {
    await db.insert(appointments).values({ ...values, businessId: ctx.business.id, createdById: ctx.user.id });
  }
  await log(ctx, blockId ? "block.update" : "block.create", `Créneau bloqué ${blockId ? "modifié" : "ajouté"} : ${v.date.split("-").reverse().join("/")} ${start}–${end}${v.note ? ` (${v.note})` : ""}`);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ───────────────────────────── Modification d'un RDV ───────────────────────────── */

const rescheduleSchema = z.object({
  date: isoDay,
  start: z.string(),
  durationMin: z.coerce.number().int().min(5).max(720),
  memberId: z.union([z.uuid(), z.literal("")]),
  /** Mot au client, joint à l'email qui annonce le nouveau créneau. */
  message: z.string().trim().max(500),
  notify: z.boolean(),
});

export async function rescheduleAppointment(rawId: string, input: z.input<typeof rescheduleSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireContext("appointments.manage");
  const id = idSchema.parse(rawId);
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const start = parseQuickTime(v.start);
  if (!start) return { ok: false, error: "Heure invalide (ex. 9, 0930 ou 14h30)." };

  const [appt] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id), eq(appointments.kind, "appointment")));
  if (!appt) return { ok: false, error: "Rendez-vous introuvable." };
  if (appt.status === "cancelled") return { ok: false, error: "Ce rendez-vous est annulé : restaurez-le d'abord." };
  if (appt.groupSessionId) return { ok: false, error: "Une inscription à un cours collectif se gère depuis la séance." };
  if (v.memberId) {
    const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, v.memberId), eq(members.businessId, ctx.business.id)));
    if (!m) return { ok: false, error: "Membre introuvable." };
  }

  const startsAt = at(v.date, start, ctx.business.timezone);
  const endsAt = new Date(startsAt.getTime() + v.durationMin * 60000);
  const moved = startsAt.getTime() !== appt.startsAt.getTime();
  try {
    await db
      .update(appointments)
      .set({ startsAt, endsAt, memberId: v.memberId || null, overbooked: appt.overbooked || (await allowsOverbooking(ctx.business.id)), reminderSentAt: moved ? null : appt.reminderSentAt })
      .where(eq(appointments.id, id));
  } catch (error) {
    if (isOverlap(error)) return { ok: false, error: "Ce membre a déjà un rendez-vous sur ce créneau." };
    throw error;
  }
  await log(ctx, "appointment.update", `Rendez-vous modifié : ${appt.contactName ?? "client"}, ${v.date.split("-").reverse().join("/")} ${start}`);
  if (moved && v.notify && startsAt > new Date()) after(() => notifyRescheduled(id, appt.startsAt, v.message || null));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Annulation par l'équipe (le client est prévenu par email s'il en a un). */
export async function cancelAppointment(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("appointments.cancel");
  const apptId = idSchema.parse(id);
  const updated = await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(appointments.id, apptId), eq(appointments.businessId, ctx.business.id), sql`${appointments.status} <> 'cancelled'`))
    .returning({ kind: appointments.kind, name: appointments.contactName, startsAt: appointments.startsAt });
  if (!updated.length) return { ok: false, error: "Rendez-vous introuvable ou déjà annulé." };
  await log(ctx, "appointment.cancel", updated[0]!.kind === "block" ? "Blocage supprimé" : `Rendez-vous annulé : ${updated[0]!.name ?? "client"}`);
  if (updated[0]!.kind === "appointment") after(() => applyBusinessCancellation(apptId));
  if (updated[0]!.kind === "appointment" && updated[0]!.startsAt > new Date()) after(() => notifyCancelledByBusiness(apptId));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Restaure un RDV annulé (s'il ne chevauche pas un autre RDV entre-temps). Le client n'est pas prévenu. */
export async function restoreAppointment(rawId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("appointments.manage");
  const id = idSchema.parse(rawId);
  try {
    const updated = await db
      .update(appointments)
      .set({ status: "confirmed", cancelledAt: null })
      .where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id), eq(appointments.status, "cancelled")))
      .returning({ name: appointments.contactName });
    if (!updated.length) return { ok: false, error: "Rendez-vous introuvable ou déjà actif." };
    await log(ctx, "appointment.restore", `Rendez-vous restauré : ${updated[0]!.name ?? "client"}`);
    after(() => syncAppointmentToGoogle(id));
  } catch (error) {
    if (isOverlap(error)) return { ok: false, error: "Le créneau a été repris entre-temps : impossible de restaurer ce rendez-vous." };
    throw error;
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Supprime définitivement des rendez-vous (historique). Les blocages et RDV d'un autre établissement sont ignorés. */
export async function deleteAppointments(rawIds: string[]): Promise<{ ok: boolean; deleted: number }> {
  const ctx = await requireContext("appointments.cancel");
  const ids = z.array(z.uuid()).max(500).parse(rawIds);
  if (ids.length === 0) return { ok: true, deleted: 0 };
  const deleted = await db.delete(appointments).where(and(eq(appointments.businessId, ctx.business.id), inArray(appointments.id, ids))).returning({ id: appointments.id });
  await log(ctx, "appointment.delete", `${deleted.length} rendez-vous supprimé${deleted.length > 1 ? "s" : ""} de l'historique`);
  revalidatePath("/app", "layout");
  return { ok: true, deleted: deleted.length };
}

/** Libère d'un coup toutes les demandes dont la date est passée (sans email). */
export async function releaseExpiredRequests(): Promise<{ ok: boolean; released: number }> {
  const ctx = await requireContext("appointments.manage");
  const released = await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(appointments.businessId, ctx.business.id), eq(appointments.status, "pending"), lt(appointments.startsAt, new Date())))
    .returning({ id: appointments.id });
  if (released.length) await log(ctx, "appointment.release", `${released.length} demande${released.length > 1 ? "s" : ""} expirée${released.length > 1 ? "s" : ""} libérée${released.length > 1 ? "s" : ""}`);
  revalidatePath("/app", "layout");
  return { ok: true, released: released.length };
}

export async function sendReminderNow(rawId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("appointments.manage");
  const id = idSchema.parse(rawId);
  const [appt] = await db.select({ email: appointments.contactEmail, status: appointments.status, name: appointments.contactName }).from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id), isNotNull(appointments.contactEmail)));
  if (!appt) return { ok: false, error: "Ce client n'a pas d'adresse email." };
  if (appt.status === "cancelled") return { ok: false, error: "Ce rendez-vous est annulé." };
  const ok = await sendManualReminder(id);
  if (!ok) return { ok: false, error: "L'email n'a pas pu partir. Réessayez plus tard." };
  await log(ctx, "appointment.reminder", `Rappel envoyé à ${appt.name ?? "client"}`);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ───────────────────────────── Détails ───────────────────────────── */

export async function setNoShow(id: string, noShow: boolean, reason: "justified" | "unjustified" | null): Promise<{ ok: boolean; message?: string; error?: string }> {
  const ctx = await requireContext("appointments.manage");
  const updated = await db
    .update(appointments)
    .set({ noShow, noShowReason: noShow ? reason : null })
    .where(and(eq(appointments.id, idSchema.parse(id)), eq(appointments.businessId, ctx.business.id)))
    .returning({ id: appointments.id });
  if (!updated.length) return { ok: false, error: "Rendez-vous introuvable." };
  revalidatePath("/app", "layout");
  // Paiement en garantie : absence non justifiée → prélèvement ; justifiée → rien n'est dû.
  if (noShow && reason) {
    const r = await applyNoShow(updated[0]!.id, reason === "justified");
    if (r.error) return { ok: true, error: `Absence notée, mais le prélèvement a échoué : ${r.error}` };
    if (r.charged && r.cents) return { ok: true, message: `Absence notée : ${(r.cents / 100).toFixed(2).replace(".", ",")} € prélevés.` };
  }
  return { ok: true };
}

/** Frais d'annulation prélevés automatiquement : rembourser (raison valable) ou garder. */
export async function decidePenalty(id: string, decision: "refunded" | "kept") {
  const ctx = await requireContext("appointments.manage");
  const [appt] = await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, idSchema.parse(id)), eq(appointments.businessId, ctx.business.id)));
  if (!appt) return { ok: false, error: "Rendez-vous introuvable." };
  const r = await reviewPenalty(appt.id, decision === "refunded" ? "refunded" : "kept");
  if (r.ok) await log(ctx, "payment.penalty_review", decision === "refunded" ? "Frais d'annulation remboursés" : "Frais d'annulation conservés");
  revalidatePath("/app", "layout");
  return r;
}

export async function saveInternalNote(id: string, note: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("appointments.manage");
  await db
    .update(appointments)
    .set({ internalNote: note.trim().slice(0, 2000) || null })
    .where(and(eq(appointments.id, idSchema.parse(id)), eq(appointments.businessId, ctx.business.id)));
  revalidatePath("/app", "layout");
  return { ok: true };
}

const paymentSchema = z.object({
  method: z.enum(["none", "on_site", "cash", "bank_transfer", "paypal", "online"]),
  status: z.enum(["none", "paid", "refunded", "partial"]),
  amount: z.string().trim().max(12),
});

/** Paiement noté à la main (paiement sur place, virement reçu…). */
export async function savePayment(rawId: string, input: z.input<typeof paymentSchema>): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("appointments.manage");
  const id = idSchema.parse(rawId);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paiement invalide." };
  const raw = parsed.data.amount.replace(/\s|€/g, "").replace(",", ".");
  if (raw && !/^\d{1,6}(\.\d{1,2})?$/.test(raw)) return { ok: false, error: "Montant invalide (ex. 45 ou 45,50)." };
  const [appt] = await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id)));
  if (!appt) return { ok: false, error: "Rendez-vous introuvable." };
  const values = { method: parsed.data.method, status: parsed.data.status, amountCents: raw ? Math.round(Number(raw) * 100) : 0 };
  await db.insert(appointmentPayments).values({ appointmentId: id, ...values }).onConflictDoUpdate({ target: appointmentPayments.appointmentId, set: values });
  revalidatePath("/app", "layout");
  return { ok: true };
}
