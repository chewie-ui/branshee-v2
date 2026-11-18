import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, bookingSettings, businesses, members } from "@/db/schema";

/** RDV retrouvé par son jeton secret (lien envoyé au client). */
export async function getAppointmentByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await db
    .select({
      a: appointments,
      memberName: members.displayName,
      cancelCutoffHours: bookingSettings.cancelCutoffHours,
      business: { id: businesses.id, locationMode: businesses.locationMode, name: businesses.name, slug: businesses.slug, timezone: businesses.timezone, address: businesses.address, postalCode: businesses.postalCode, city: businesses.city, phone: businesses.phone, brand: businesses.brand },
    })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(bookingSettings, eq(bookingSettings.businessId, appointments.businessId))
    .where(eq(appointments.manageToken, token));
  if (!row || row.a.kind !== "appointment") return null;
  return row;
}

/**
 * Annulation / déplacement en ligne encore permis ? Le pro peut fermer cette possibilité N heures avant le RDV.
 * Toujours revérifié côté serveur, pas seulement en masquant les boutons.
 */
export function onlineChangeLocked(row: { a: { startsAt: Date }; cancelCutoffHours: number | null }, now = new Date()) {
  const h = row.cancelCutoffHours;
  if (!h) return false;
  return row.a.startsAt.getTime() - now.getTime() < h * 3_600_000;
}

/** Message affiché au client quand le délai est passé. */
export function lockedMessage(row: { cancelCutoffHours: number | null; business: { phone: string | null; name: string } }) {
  const h = row.cancelCutoffHours ?? 0;
  const delay = h === 1 ? "1 heure" : `${h} heures`;
  return `Moins de ${delay} avant votre rendez-vous, il ne peut plus être annulé ni déplacé en ligne. Contactez ${row.business.name}${row.business.phone ? ` au ${row.business.phone}` : ""}.`;
}
