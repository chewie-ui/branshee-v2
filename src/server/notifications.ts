import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, bookingSettings, businesses, members, notificationSettings, users, waitlistEntries } from "@/db/schema";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { formatDay, formatTime } from "@/lib/time";
import { emails, type AppointmentInfo } from "@/server/email/templates";
import { sendEmail } from "@/server/email/mailer";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

async function load(appointmentId: string) {
  const [row] = await db
    .select({ a: appointments, business: businesses, memberName: members.displayName, memberUserId: members.userId, settings: notificationSettings })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(notificationSettings, eq(notificationSettings.businessId, appointments.businessId))
    .where(eq(appointments.id, appointmentId));
  if (!row) return null;
  const { a, business: b } = row;
  const when = `${formatDay(a.startsAt, b.timezone, "EEEE d MMMM")} à ${formatTime(a.startsAt, b.timezone)}`;
  const info: AppointmentInfo = {
    businessName: b.name,
    serviceName: a.serviceName ?? "Rendez-vous",
    when: when.charAt(0).toUpperCase() + when.slice(1),
    memberName: row.memberName,
    address: b.locationMode === "online" ? "En ligne" : [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    customerName: a.contactName ?? "Client",
    manageUrl: `${appUrl()}/r/${a.manageToken}`,
    businessPhone: b.phone,
  };
  return { ...row, info, bookingUrl: `${appUrl()}/${b.slug}` };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

const reminderMail = (row: Loaded) => emails.reminder(row.info, row.settings?.reminderMessage, { methods: row.settings?.reminderPaymentMethods ?? [], note: row.settings?.reminderPaymentNote });

/** Destinataires côté pro : le propriétaire et le praticien concerné (sans doublon). */
async function proRecipients(row: Loaded) {
  const ids = [row.business.ownerId, row.memberUserId].filter((x): x is string => !!x);
  const list = await db.select({ email: users.email }).from(users).where(and(inArray(users.id, ids), isNull(users.disabledAt)));
  return [...new Set(list.map((u) => u.email))];
}

function toClient(row: Loaded, template: string, mail: { subject: string; html: string; text: string }) {
  if (!row.a.contactEmail) return Promise.resolve(false);
  return sendEmail({ ...mail, to: row.a.contactEmail, template, replyTo: row.business.email, businessId: row.business.id, appointmentId: row.a.id });
}

/** Les notifications ne doivent jamais faire échouer l'action qui les déclenche. */
async function safely(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[notifications] ${label} :`, e);
  }
}

export function notifyBookingCreated(appointmentId: string, source: "online" | "pro") {
  return safely("création", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    const pending = row.a.status === "pending";
    await toClient(row, pending ? "booking_requested" : "booking_confirmed", pending ? emails.bookingRequested(row.info) : emails.bookingConfirmed(row.info, row.settings?.confirmationMessage));

    if (source === "online" && (row.settings?.emailOwnerOnNewBooking ?? true)) {
      const mail = emails.proNewBooking({ ...row.info, pending, customerEmail: row.a.contactEmail, customerPhone: row.a.contactPhone }, `${appUrl()}/app`);
      for (const to of await proRecipients(row)) await sendEmail({ ...mail, to, template: "pro_new_booking", businessId: row.business.id, appointmentId: row.a.id });
    }
  });
}

export function notifyRequestDecision(appointmentId: string, accepted: boolean, reason?: string | null) {
  if (!accepted) void notifyWaitlist(appointmentId);
  return safely("décision", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, accepted ? "request_accepted" : "request_refused", accepted ? emails.requestAccepted(row.info, row.settings?.confirmationMessage) : emails.requestRefused(row.info, row.bookingUrl, reason));
  });
}

export function notifyCancelledByCustomer(appointmentId: string) {
  void notifyWaitlist(appointmentId);
  return safely("annulation client", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, "cancelled_customer", emails.cancelledForCustomer(row.info, row.bookingUrl, row.settings?.cancellationMessage));
    if (row.settings?.emailOwnerOnCancellation ?? true) {
      const mail = emails.proCancelled(row.info, `${appUrl()}/app/agenda`);
      for (const to of await proRecipients(row)) await sendEmail({ ...mail, to, template: "pro_cancelled", businessId: row.business.id, appointmentId: row.a.id });
    }
  });
}

export function notifyCancelledByBusiness(appointmentId: string) {
  void notifyWaitlist(appointmentId);
  return safely("annulation établissement", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, "cancelled_by_business", emails.cancelledForCustomer(row.info, row.bookingUrl, row.settings?.cancellationMessage));
  });
}

/**
 * Un créneau se libère (annulation) : on prévient les personnes en liste d'attente ce jour-là,
 * pour cette prestation (ou sans prestation précise). Chacune n'est prévenue qu'une fois.
 */
export function notifyWaitlist(appointmentId: string) {
  return safely("liste d'attente", async () => {
    const row = await load(appointmentId);
    if (!row || row.a.kind !== "appointment" || row.a.groupSessionId || row.a.startsAt < new Date()) return;
    const [settings] = await db.select({ on: bookingSettings.waitlistEnabled }).from(bookingSettings).where(eq(bookingSettings.businessId, row.business.id));
    if (!settings?.on) return;
    const tz = row.business.timezone;
    const day = format(new TZDate(row.a.startsAt, tz), "yyyy-MM-dd");
    const claimed = await db
      .update(waitlistEntries)
      .set({ notifiedAt: new Date() })
      .where(and(eq(waitlistEntries.businessId, row.business.id), eq(waitlistEntries.date, day), isNull(waitlistEntries.notifiedAt), row.a.serviceId ? or(isNull(waitlistEntries.serviceId), eq(waitlistEntries.serviceId, row.a.serviceId)) : isNull(waitlistEntries.serviceId), row.a.memberId ? or(isNull(waitlistEntries.memberId), eq(waitlistEntries.memberId, row.a.memberId)) : undefined))
      .returning();
    const label = formatDay(row.a.startsAt, tz, "EEEE d MMMM");
    for (const w of claimed) {
      const mail = emails.waitlistSpot({ name: w.name, businessName: row.business.name, day: label, serviceName: row.a.serviceName, bookingUrl: row.bookingUrl, businessPhone: row.business.phone });
      await sendEmail({ ...mail, to: w.email, template: "waitlist_spot", replyTo: row.business.email, businessId: row.business.id, appointmentId: row.a.id });
    }
  });
}

/** RDV déplacé par le pro : le client reçoit le nouveau créneau, et le mot du pro s'il y en a un. */
export function notifyRescheduled(appointmentId: string, previousStart: Date, message?: string | null) {
  return safely("déplacement", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    const tz = row.business.timezone;
    const before = `le ${formatDay(previousStart, tz, "EEEE d MMMM")} à ${formatTime(previousStart, tz)}`;
    await toClient(row, "rescheduled", emails.rescheduled(row.info, before, message));
  });
}

/** Rappel envoyé à la main par le pro (bouton « Envoyer un rappel »). Renvoie false si le client n'a pas d'email. */
export async function sendManualReminder(appointmentId: string) {
  const row = await load(appointmentId);
  if (!row || !row.a.contactEmail) return false;
  const ok = await toClient(row, "reminder_manual", reminderMail(row));
  if (ok) await db.update(appointments).set({ manualReminderSentAt: new Date() }).where(eq(appointments.id, appointmentId));
  return ok;
}

/**
 * Rappels : RDV confirmés dans la fenêtre « délai de rappel » de leur établissement, pas encore rappelés.
 * Idempotent : chaque RDV est marqué AVANT l'envoi, donc deux exécutions simultanées n'envoient pas deux fois.
 */
export async function sendDueReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 72 * 3600000); // délai maximum réglable
  const candidates = await db
    .select({ id: appointments.id, startsAt: appointments.startsAt, delay: notificationSettings.reminderDelayHours })
    .from(appointments)
    .leftJoin(notificationSettings, eq(notificationSettings.businessId, appointments.businessId))
    .where(
      and(
        eq(appointments.status, "confirmed"),
        eq(appointments.kind, "appointment"),
        isNull(appointments.reminderSentAt),
        isNotNull(appointments.contactEmail),
        gt(appointments.startsAt, now),
        lte(appointments.startsAt, horizon),
      ),
    );

  let sent = 0;
  for (const c of candidates) {
    const delayMs = (c.delay ?? 24) * 3600000;
    if (c.startsAt.getTime() - now.getTime() > delayMs) continue;
    const claimed = await db
      .update(appointments)
      .set({ reminderSentAt: now })
      .where(and(eq(appointments.id, c.id), isNull(appointments.reminderSentAt)))
      .returning({ id: appointments.id });
    if (!claimed.length) continue;
    const row = await load(c.id);
    if (row && (await toClient(row, "reminder", reminderMail(row)))) sent++;
  }
  return { checked: candidates.length, sent };
}

/** Le client a déplacé lui-même son RDV : confirmation au client, alerte au pro. */
export function notifyRescheduledByCustomer(appointmentId: string, previousStart: Date) {
  return safely("report client", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    const tz = row.business.timezone;
    const before = `${formatDay(previousStart, tz, "EEEE d MMMM")} à ${formatTime(previousStart, tz)}`;
    const prev = before.charAt(0).toUpperCase() + before.slice(1);
    await toClient(row, "rescheduled_by_customer", emails.bookingConfirmed(row.info, row.settings?.confirmationMessage));
    const mail = emails.proRescheduledByCustomer(row.info, prev, `${appUrl()}/app/agenda/rdv/${row.a.id}`);
    for (const to of await proRecipients(row)) await sendEmail({ ...mail, to, template: "pro_rescheduled", businessId: row.business.id, appointmentId: row.a.id });
  });
}
