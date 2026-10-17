"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, appointments } from "@/db/schema";
import { getAppointmentByToken } from "@/server/manage";
import { notifyCancelledByCustomer } from "@/server/notifications";

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
    after(() => notifyCancelledByCustomer(id));
  }
  revalidatePath(`/r/${token}`);
  return { ok: true };
}
