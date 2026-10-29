import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, members, weeklyHours } from "@/db/schema";
import { boundsFrom, type Week } from "@/lib/opening";

/**
 * Horaires d'ouverture de l'entreprise (cadre des prestations). Horaires par praticien : réunion de leurs
 * horaires. Aucun horaire saisi : pas de cadre (null).
 */
export async function openingBounds(businessId: string): Promise<Week | null> {
  const [s] = await db.select({ mode: bookingSettings.scheduleMode }).from(bookingSettings).where(eq(bookingSettings.businessId, businessId));
  let rows: { weekday: number; start: string; end: string }[];
  if ((s?.mode ?? "shared") === "shared") {
    rows = await db.select({ weekday: weeklyHours.weekday, start: weeklyHours.startTime, end: weeklyHours.endTime }).from(weeklyHours).where(and(eq(weeklyHours.businessId, businessId), isNull(weeklyHours.memberId)));
  } else {
    const team = await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, businessId), eq(members.status, "active"), eq(members.isActive, true), eq(members.isBookable, true)));
    rows = team.length ? await db.select({ weekday: weeklyHours.weekday, start: weeklyHours.startTime, end: weeklyHours.endTime }).from(weeklyHours).where(and(eq(weeklyHours.businessId, businessId), inArray(weeklyHours.memberId, team.map((m) => m.id)))) : [];
  }
  return boundsFrom(rows);
}
