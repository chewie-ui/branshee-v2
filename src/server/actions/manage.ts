"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, appointments } from "@/db/schema";
import { getAppointmentByToken } from "@/server/manage";
import { notifyCancelledByCustomer, notifyRescheduledByCustomer } from "@/server/notifications";
import { getAvailableSlots } from "@/server/availability";
import { applyCustomerCancellation } from "@/server/payments";
import { rateLimit } from "@/server/auth/rate-limit";
import { headers } from "next/headers";
import { services } from "@/db/schema";
import { clientIp as ipFrom } from "@/lib/client-ip";

export async function cancelByToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const row = await getAppointmentByToken(token);
  if (!row) return { ok: false, error: "Rendez-vous introuvable." };
  if (row.a.status === "cancelled") return { ok: true };
  if (row.a.startsAt <= new Date()) return { ok: false, error: "Ce rendez-vous est déjà passé ; contactez l'établissement." };

  const updated = await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(appointments.id, row.a.id), ne(appointments.status, "cancelled"), gt(appointments.startsAt, new Date())))
    .returning({ id: appointments.id });
  if (updated.length) {
    await db.insert(activityLogs).values({ businessId: row.a.businessId, actorName: row.a.contactName ?? "Client", action: "appointment.cancel_by_customer", description: `Annulé par le client : ${row.a.serviceName ?? "rendez-vous"}` });
    const id = row.a.id;
    after(async () => {
      await applyCustomerCancellation(id);
      await notifyCancelledByCustomer(id);
    });
  }
  revalidatePath(`/r/${token}`);
  return { ok: true };
}

async function reschedulable(token: string) {
  const row = await getAppointmentByToken(token);
  if (!row || row.a.status === "cancelled" || row.a.groupSessionId || !row.a.serviceId || !row.a.memberId) return null;
  if (row.a.startsAt <= new Date()) return null;
  const [svc] = await db.select({ id: services.id, kind: services.kind, isActive: services.isActive }).from(services).where(eq(services.id, row.a.serviceId));
  if (!svc || svc.kind !== "individual" || !svc.isActive) return null;
  return row;
}

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
function nextDays(from: string, count: number) {
  const out: string[] = [];
  const d = new Date(from + "T12:00:00Z");
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
async function clientIp() {
  const h = await headers();
  return ipFrom(h) ?? "unknown";
}

/** Créneaux libres pour déplacer un RDV (même prestation, même praticien, règles de la réservation en ligne). */
export async function getRescheduleSlots(token: string, fromDay: string): Promise<{ date: string; times: string[] }[]> {
  if (!isoDay.test(fromDay) || !rateLimit(`resched-slots:${await clientIp()}`, 120, 60_000).ok) return [];
  const row = await reschedulable(token);
  if (!row) return [];
  const days = nextDays(fromDay, 7);
  const slots = await getAvailableSlots({ businessId: row.a.businessId, serviceId: row.a.serviceId!, memberId: row.a.memberId!, days, excludeAppointmentId: row.a.id });
  return days.map((date) => ({ date, times: (slots[date] ?? []).map((s) => s.time) }));
}

export async function rescheduleByToken(token: string, date: string, time: string): Promise<{ ok: boolean; error?: string }> {
  if (!isoDay.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "Créneau invalide." };
  if (!rateLimit(`resched:${await clientIp()}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  const row = await reschedulable(token);
  if (!row) return { ok: false, error: "Ce rendez-vous ne peut plus être déplacé en ligne. Contactez l'établissement." };
  // Revérification au moment de valider : le pro a pu poser un congé, quelqu'un a pu réserver.
  const slots = await getAvailableSlots({ businessId: row.a.businessId, serviceId: row.a.serviceId!, memberId: row.a.memberId!, days: [date], excludeAppointmentId: row.a.id });
  const slot = (slots[date] ?? []).find((s) => s.time === time);
  if (!slot) return { ok: false, error: "Ce créneau n'est plus disponible. Choisissez-en un autre." };
  const previous = row.a.startsAt;
  try {
    await db
      .update(appointments)
      .set({ startsAt: slot.startsAt, endsAt: slot.endsAt, reminderSentAt: null })
      .where(and(eq(appointments.id, row.a.id), ne(appointments.status, "cancelled")));
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23P01" || e.cause?.code === "23P01") return { ok: false, error: "Ce créneau vient d'être pris. Choisissez-en un autre." };
    throw error;
  }
  await db.insert(activityLogs).values({ businessId: row.a.businessId, actorName: row.a.contactName ?? "Client", action: "appointment.reschedule_by_customer", description: `Déplacé par le client : ${row.a.serviceName ?? "rendez-vous"}, ${date} ${time}` });
  const id = row.a.id;
  after(() => notifyRescheduledByCustomer(id, previous));
  revalidatePath(`/r/${token}`);
  return { ok: true };
}
