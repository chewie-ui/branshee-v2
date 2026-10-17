"use server";

import { TZDate } from "@date-fns/tz";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, appointments, customers, members, services } from "@/db/schema";
import { getAvailableSlots } from "@/server/availability";
import { requireContext } from "@/server/context";
import { notifyBookingCreated, notifyCancelledByBusiness, notifyRequestDecision } from "@/server/notifications";

const idSchema = z.uuid();

/** Erreur prévue, dont le message peut être montré tel quel à l'utilisateur. */
class UserError extends Error {}

async function setStatus(rawId: string, status: "confirmed" | "cancelled", action: string, label: string) {
  const ctx = await requireContext(status === "cancelled" ? "appointments.cancel" : "appointments.manage");
  const id = idSchema.parse(rawId);

  let updated: { id: string; contactName: string | null }[];
  try {
    updated = await db
      .update(appointments)
      .set({ status, cancelledAt: status === "cancelled" ? new Date() : null })
      .where(and(eq(appointments.id, id), eq(appointments.businessId, ctx.business.id), eq(appointments.status, "pending")))
      .returning({ id: appointments.id, contactName: appointments.contactName });
  } catch (error) {
    // 23P01 = contrainte anti-chevauchement : un autre RDV confirmé occupe déjà ce créneau.
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23P01" || e.cause?.code === "23P01") {
      return { ok: false as const, error: "Ce créneau est déjà pris par un autre rendez-vous confirmé." };
    }
    throw error;
  }

  if (updated.length === 0) return { ok: false as const, error: "Cette demande a déjà été traitée." };

  await db.insert(activityLogs).values({
    businessId: ctx.business.id,
    userId: ctx.user.id,
    actorName: ctx.user.name,
    action,
    description: `${label} : ${updated[0]!.contactName ?? "client"}`,
  });

  after(() => notifyRequestDecision(id, status === "confirmed"));
  revalidatePath("/app", "layout");
  return { ok: true as const };
}

export async function confirmRequest(id: string) {
  return setStatus(id, "confirmed", "appointment.confirm", "Demande confirmée");
}

export async function refuseRequest(id: string) {
  return setStatus(id, "cancelled", "appointment.refuse", "Demande refusée");
}

const createSchema = z
  .object({
    serviceId: z.uuid({ message: "Choisissez une prestation." }),
    memberId: z.uuid({ message: "Choisissez un membre de l'équipe." }),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
    customerId: z.union([z.uuid(), z.literal("")]),
    newName: z.string().trim().max(120),
    newEmail: z.union([z.email({ message: "Email invalide." }), z.literal("")]),
    newPhone: z.string().trim().max(40),
    note: z.string().trim().max(1000),
    notify: z.string(),
  })
  .refine((v) => v.customerId !== "" || v.newName.length > 1, { message: "Choisissez un client ou saisissez un nom.", path: ["newName"] });

export type CreateAppointmentState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createAppointment(_prev: CreateAppointmentState, formData: FormData): Promise<CreateAppointmentState> {
  const ctx = await requireContext("appointments.manage");
  const parsed = createSchema.safeParse(Object.fromEntries(["serviceId", "memberId", "date", "time", "customerId", "newName", "newEmail", "newPhone", "note", "notify"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const v = parsed.data;

  const [service] = await db.select().from(services).where(and(eq(services.id, v.serviceId), eq(services.businessId, ctx.business.id)));
  const [member] = await db.select().from(members).where(and(eq(members.id, v.memberId), eq(members.businessId, ctx.business.id)));
  if (!service || !member) return { error: "Prestation ou membre introuvable." };

  const [y, mo, d] = v.date.split("-").map(Number) as [number, number, number];
  const [h, mi] = v.time.split(":").map(Number) as [number, number];
  const startsAt = new Date(new TZDate(y, mo - 1, d, h, mi, 0, ctx.business.timezone).getTime());
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

  // Client + rendez-vous dans une seule transaction : si le créneau est pris, rien n'est créé.
  let createdId: string | null = null;
  try {
    await db.transaction(async (tx) => {
      let customerId = v.customerId || null;
      let contact = { name: v.newName, email: v.newEmail || null, phone: v.newPhone || null };
      if (customerId) {
        const [c] = await tx.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, ctx.business.id)));
        if (!c) throw new UserError("Client introuvable.");
        contact = { name: c.fullName, email: c.email, phone: c.phone };
      } else {
        const [c] = await tx
          .insert(customers)
          .values({ businessId: ctx.business.id, fullName: v.newName, email: v.newEmail || null, phone: v.newPhone || null, createdManually: true })
          .onConflictDoNothing()
          .returning({ id: customers.id });
        if (c) customerId = c.id;
        else if (v.newEmail) {
          // Un client avec cet email existe déjà : on le réutilise.
          const [existing] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, ctx.business.id), sql`lower(${customers.email}) = lower(${v.newEmail})`));
          customerId = existing?.id ?? null;
        }
      }

      const [created] = await tx.insert(appointments).values({
        businessId: ctx.business.id,
        status: "confirmed",
        startsAt,
        endsAt,
        memberId: member.id,
        serviceId: service.id,
        customerId,
        serviceName: service.name,
        serviceColor: service.color,
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        internalNote: v.note || null,
        createdById: ctx.user.id,
      }).returning({ id: appointments.id });
      createdId = created!.id;

      await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "appointment.create", description: `Rendez-vous créé : ${contact.name}, ${v.date} ${v.time}` });
    });
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23P01" || e.cause?.code === "23P01") return { fieldErrors: { time: `${member.displayName} a déjà un rendez-vous sur ce créneau.` } };
    throw error;
  }

  if (createdId && v.notify === "on") {
    const id = createdId;
    after(() => notifyBookingCreated(id, "pro"));
  }
  revalidatePath("/app", "layout");
  redirect(`/app/agenda?semaine=${v.date}`);
}

/** Créneaux libres pour aider à choisir l'heure dans le formulaire de création. */
export async function fetchFreeSlots(serviceId: string, memberId: string, date: string): Promise<string[]> {
  const ctx = await requireContext("appointments.manage");
  const parsed = z.object({ serviceId: z.uuid(), memberId: z.uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse({ serviceId, memberId, date });
  if (!parsed.success) return [];
  // Côté pro, on ignore le délai minimum et l'horizon : ils ne concernent que la réservation en ligne.
  const slots = await getAvailableSlots({ businessId: ctx.business.id, serviceId, memberId, days: [date], ignoreOnlineRules: true });
  return (slots[date] ?? []).map((s) => s.time);
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
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "appointment.cancel", description: `${updated[0]!.kind === "block" ? "Blocage supprimé" : `Rendez-vous annulé : ${updated[0]!.name ?? "client"}`}` });
  if (updated[0]!.kind === "appointment" && updated[0]!.startsAt > new Date()) after(() => notifyCancelledByBusiness(apptId));
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function setNoShow(id: string, noShow: boolean, reason: "justified" | "unjustified" | null): Promise<{ ok: boolean }> {
  const ctx = await requireContext("appointments.manage");
  await db
    .update(appointments)
    .set({ noShow, noShowReason: noShow ? reason : null })
    .where(and(eq(appointments.id, idSchema.parse(id)), eq(appointments.businessId, ctx.business.id)));
  revalidatePath("/app", "layout");
  return { ok: true };
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
