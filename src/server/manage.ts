import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, members } from "@/db/schema";

/** RDV retrouvé par son jeton secret (lien envoyé au client). */
export async function getAppointmentByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await db
    .select({
      a: appointments,
      memberName: members.displayName,
      business: { name: businesses.name, slug: businesses.slug, timezone: businesses.timezone, address: businesses.address, postalCode: businesses.postalCode, city: businesses.city, phone: businesses.phone },
    })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .leftJoin(members, eq(members.id, appointments.memberId))
    .where(eq(appointments.manageToken, token));
  if (!row || row.a.kind !== "appointment") return null;
  return row;
}
