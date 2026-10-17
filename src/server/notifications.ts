import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, members, notificationSettings, users } from "@/db/schema";
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
    address: [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    customerName: a.contactName ?? "Client",
    manageUrl: `${appUrl()}/r/${a.manageToken}`,
    businessPhone: b.phone,
  };
  return { ...row, info, bookingUrl: `${appUrl()}/${b.slug}` };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

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

export function notifyRequestDecision(appointmentId: string, accepted: boolean) {
  return safely("décision", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, accepted ? "request_accepted" : "request_refused", accepted ? emails.requestAccepted(row.info, row.settings?.confirmationMessage) : emails.requestRefused(row.info, row.bookingUrl));
  });
}

export function notifyCancelledByCustomer(appointmentId: string) {
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
    if (row && (await toClient(row, "reminder", emails.reminder(row.info, row.settings?.reminderMessage)))) sent++;
  }
  return { checked: candidates.length, sent };
}
