import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, bookingSettings, businesses, members, notificationSettings, users, waitlistEntries } from "@/db/schema";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { formatDay, formatTime } from "@/lib/time";
import { emails, type AppointmentInfo } from "@/server/email/templates";
import { createT, getMessages, intlLocale } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { sendEmail } from "@/server/email/mailer";
import { sendPush } from "@/server/push";
import { businessHas, effectivePlan } from "@/server/plan";
import { LIMITS } from "@/lib/plans";
import { syncAppointmentToGoogle } from "@/server/google";
import { SMS_PRICE_CENTS, WHATSAPP_PRICE_CENTS, chargeAndSend, sendSms, sendWhatsapp, smsFeatureOn, smsText, whatsappConfigured } from "@/server/sms";

/** « lundi 3 mars à 10:00 » dans la langue du client (sans majuscule imposée). */
function dayAndTime(d: Date, tz: string, locale: Locale) {
  const day = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(d);
  return createT(getMessages(locale))("email.atTime", { day, time: formatTime(d, tz) });
}
const dayOnly = (d: Date, tz: string, locale: Locale) => new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(d);
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    noBranding: await businessHas(b.id, "noBranding"),
  };
  // Version envoyée au client, dans la langue choisie à la réservation (les emails au pro restent en français).
  const locale: Locale = isLocale(a.locale) ? a.locale : "fr";
  const clientInfo: AppointmentInfo =
    locale === "fr"
      ? info
      : { ...info, locale, when: capFirst(dayAndTime(a.startsAt, b.timezone, locale)), serviceName: a.serviceName ?? getMessages(locale).manage.appointment, address: b.locationMode === "online" ? getMessages(locale).common.online : info.address, customerName: info.customerName };
  return { ...row, info, clientInfo, locale, bookingUrl: `${appUrl()}/${b.slug}` };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

const reminderMail = (row: Loaded) => emails.reminder(row.clientInfo, row.settings?.reminderMessage, { methods: row.settings?.reminderPaymentMethods ?? [], note: row.settings?.reminderPaymentNote });

/** Notification sur l'application du propriétaire et du praticien concerné (n'empêche jamais le reste). */
function pushToPros(row: Loaded, title: string, body: string, type: string) {
  const ids = [row.business.ownerId, row.memberUserId].filter((x): x is string => !!x);
  return sendPush(ids, { title, body, data: { type, bookingId: row.a.id, companyId: row.business.id } });
}

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

/**
 * Rappel / confirmation par WhatsApp puis SMS, selon les réglages et le forfait (payant uniquement).
 * Renvoie true si un message est parti sur le téléphone.
 */
async function toPhone(row: Loaded, kind: "reminder" | "confirmation") {
  const phone = row.a.contactPhone;
  const st = row.settings;
  if (!phone || !st) return false;
  const wantWa = kind === "reminder" ? st.whatsappReminders : st.whatsappConfirmations;
  const wantSms = kind === "reminder" ? st.smsReminders : st.smsConfirmations;
  if (!wantWa && !wantSms) return false;
  const plan = (await effectivePlan(row.business.id)).plan;
  if (plan === "free") return false;
  const owner = row.business.ownerId;
  const tz = row.business.timezone;
  const date = formatDay(row.a.startsAt, tz, "EEEE d MMMM");
  const time = formatTime(row.a.startsAt, tz);
  if (wantWa && whatsappConfigured()) {
    const params = [(row.a.contactName ?? "").split(" ")[0] ?? "", row.business.name, date, time];
    const r = await chargeAndSend(owner, plan, st.smsAllowOverage, WHATSAPP_PRICE_CENTS, () => sendWhatsapp(phone, kind, params));
    if (r.sent) return true;
  }
  if (wantSms && (await smsFeatureOn())) {
    const body = smsText(kind, { business: row.business.name, date, time, address: row.info.address, link: `${appUrl()}/g/${row.a.manageToken.slice(0, 16)}` });
    const r = await chargeAndSend(owner, plan, st.smsAllowOverage, SMS_PRICE_CENTS, () => sendSms(phone, body));
    if (r.sent) return true;
  }
  return false;
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
  void syncAppointmentToGoogle(appointmentId);
  return safely("création", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    const pending = row.a.status === "pending";
    await toClient(row, pending ? "booking_requested" : "booking_confirmed", pending ? emails.bookingRequested(row.clientInfo) : emails.bookingConfirmed(row.clientInfo, row.settings?.confirmationMessage));
    if (!pending) await toPhone(row, "confirmation");

    if (source === "online") await pushToPros(row, pending ? "Nouvelle demande de rendez-vous" : "Nouveau rendez-vous", `${row.a.contactName ?? "Client"} · ${row.info.serviceName} · ${row.info.when}`, "booking");
    if (source === "online" && (row.settings?.emailOwnerOnNewBooking ?? true)) {
      const mail = emails.proNewBooking({ ...row.info, pending, customerEmail: row.a.contactEmail, customerPhone: row.a.contactPhone }, `${appUrl()}/app`);
      for (const to of await proRecipients(row)) await sendEmail({ ...mail, to, template: "pro_new_booking", businessId: row.business.id, appointmentId: row.a.id });
    }
  });
}

export function notifyRequestDecision(appointmentId: string, accepted: boolean, reason?: string | null) {
  void syncAppointmentToGoogle(appointmentId);
  if (!accepted) void notifyWaitlist(appointmentId);
  return safely("décision", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, accepted ? "request_accepted" : "request_refused", accepted ? emails.requestAccepted(row.clientInfo, row.settings?.confirmationMessage) : emails.requestRefused(row.clientInfo, row.bookingUrl, reason));
  });
}

export function notifyCancelledByCustomer(appointmentId: string) {
  void syncAppointmentToGoogle(appointmentId);
  void notifyWaitlist(appointmentId);
  return safely("annulation client", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, "cancelled_customer", emails.cancelledForCustomer(row.clientInfo, row.bookingUrl, row.settings?.cancellationMessage));
    await pushToPros(row, "Rendez-vous annulé", `${row.a.contactName ?? "Client"} · ${row.info.when}`, "cancellation");
    if (row.settings?.emailOwnerOnCancellation ?? true) {
      const mail = emails.proCancelled(row.info, `${appUrl()}/app/agenda`);
      for (const to of await proRecipients(row)) await sendEmail({ ...mail, to, template: "pro_cancelled", businessId: row.business.id, appointmentId: row.a.id });
    }
  });
}

export function notifyCancelledByBusiness(appointmentId: string) {
  void syncAppointmentToGoogle(appointmentId);
  void notifyWaitlist(appointmentId);
  return safely("annulation établissement", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    await toClient(row, "cancelled_by_business", emails.cancelledForCustomer(row.clientInfo, row.bookingUrl, row.settings?.cancellationMessage));
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
    for (const w of claimed) {
      const wl: Locale = isLocale(w.locale) ? w.locale : "fr";
      const mail = emails.waitlistSpot({ name: w.name, businessName: row.business.name, day: dayOnly(row.a.startsAt, tz, wl), serviceName: row.a.serviceName, bookingUrl: row.bookingUrl, businessPhone: row.business.phone, locale: wl });
      await sendEmail({ ...mail, to: w.email, template: "waitlist_spot", replyTo: row.business.email, businessId: row.business.id, appointmentId: row.a.id });
    }
  });
}

/** RDV déplacé par le pro : le client reçoit le nouveau créneau, et le mot du pro s'il y en a un. */
export function notifyRescheduled(appointmentId: string, previousStart: Date, message?: string | null) {
  void syncAppointmentToGoogle(appointmentId);
  return safely("déplacement", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    const tz = row.business.timezone;
    const before = dayAndTime(previousStart, tz, row.locale);
    await toClient(row, "rescheduled", emails.rescheduled(row.clientInfo, row.locale === "fr" ? `le ${before}` : before, message));
  });
}

/** Message libre écrit par le pro, envoyé par email au client avec le récapitulatif du RDV. */
export async function sendCustomMessage(appointmentId: string, message: string) {
  const row = await load(appointmentId);
  if (!row || !row.a.contactEmail) return false;
  return toClient(row, "custom_message", emails.customMessage(row.clientInfo, message));
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
    .select({ id: appointments.id, businessId: appointments.businessId, startsAt: appointments.startsAt, delay: notificationSettings.reminderDelayHours })
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
  // Rappels automatiques : à partir du forfait Pro (le rappel manuel reste possible partout).
  const allowed = new Map<string, boolean>();
  for (const c of candidates) {
    if (!allowed.has(c.businessId)) allowed.set(c.businessId, await businessHas(c.businessId, "emailReminders"));
    if (!allowed.get(c.businessId)) continue;
    const delayMs = (c.delay ?? 24) * 3600000;
    if (c.startsAt.getTime() - now.getTime() > delayMs) continue;
    const claimed = await db
      .update(appointments)
      .set({ reminderSentAt: now })
      .where(and(eq(appointments.id, c.id), isNull(appointments.reminderSentAt)))
      .returning({ id: appointments.id });
    if (!claimed.length) continue;
    const row = await load(c.id);
    if (!row) continue;
    // WhatsApp, puis SMS ; l'email ne part que si aucun des deux n'a pu partir (comme l'ancien).
    if (await toPhone(row, "reminder")) {
      sent++;
      continue;
    }
    if (await toClient(row, "reminder", reminderMail(row))) sent++;
  }
  return { checked: candidates.length, sent };
}

/** Le client a déplacé lui-même son RDV : confirmation au client, alerte au pro. */
export function notifyRescheduledByCustomer(appointmentId: string, previousStart: Date) {
  void syncAppointmentToGoogle(appointmentId);
  return safely("report client", async () => {
    const row = await load(appointmentId);
    if (!row) return;
    const tz = row.business.timezone;
    const before = `${formatDay(previousStart, tz, "EEEE d MMMM")} à ${formatTime(previousStart, tz)}`;
    const prev = before.charAt(0).toUpperCase() + before.slice(1);
    await toClient(row, "rescheduled_by_customer", emails.bookingConfirmed(row.clientInfo, row.settings?.confirmationMessage));
    await pushToPros(row, "Rendez-vous déplacé par le client", `${row.a.contactName ?? "Client"} · ${row.info.when}`, "booking");
    const mail = emails.proRescheduledByCustomer(row.info, prev, `${appUrl()}/app/agenda/rdv/${row.a.id}`);
    for (const to of await proRecipients(row)) await sendEmail({ ...mail, to, template: "pro_rescheduled", businessId: row.business.id, appointmentId: row.a.id });
  });
}

/** Limite mensuelle de confirmations automatiques atteinte (forfait gratuit) : le propriétaire est prévenu une fois par mois. */
export function notifyAutoConfirmLimit(businessId: string, timezone: string) {
  return safely("limite mensuelle", async () => {
    const month = format(new TZDate(new Date(), timezone), "yyyy-MM");
    const [b] = await db
      .update(businesses)
      .set({ limitNoticeMonth: month })
      .where(and(eq(businesses.id, businessId), or(isNull(businesses.limitNoticeMonth), sql`${businesses.limitNoticeMonth} <> ${month}`)))
      .returning({ name: businesses.name, ownerId: businesses.ownerId });
    if (!b) return;
    const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, b.ownerId));
    if (!owner) return;
    const mail = emails.autoConfirmLimit({ businessName: b.name, max: LIMITS.autoConfirmUpTo.free, url: `${appUrl()}/app/reglages/abonnement` });
    await sendEmail({ to: owner.email, ...mail, template: "auto_confirm_limit", businessId });
  });
}

/** Bienvenue au pro qui crée son premier établissement. */
export function notifyWelcomePro(userId: string, businessName: string) {
  return safely("bienvenue", async () => {
    const [u] = await db.select({ email: users.email, name: users.fullName }).from(users).where(eq(users.id, userId));
    if (!u) return;
    await sendEmail({ to: u.email, ...emails.welcomePro({ name: u.name.trim().split(/\s+/)[0] ?? u.name, businessName, url: `${appUrl()}/app` }), template: "welcome_pro" });
  });
}
