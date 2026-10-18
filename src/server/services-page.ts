import "server-only";
import { featureOn } from "@/server/features";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings, members, serviceCategories } from "@/db/schema";

/** Données communes aux formulaires de prestation. */
export async function serviceFormData(businessId: string) {
  const [categories, team, [settings]] = await Promise.all([
    db.select({ id: serviceCategories.id, name: serviceCategories.name }).from(serviceCategories).where(eq(serviceCategories.businessId, businessId)).orderBy(asc(serviceCategories.position)),
    db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, businessId), eq(members.status, "active"), eq(members.isBookable, true))).orderBy(asc(members.createdAt)),
    db.select({ q: bookingSettings.firstVisitQuestion }).from(bookingSettings).where(eq(bookingSettings.businessId, businessId)),
  ]);
  return { categories, team, showAudience: settings?.q.enabled ?? false, allowGroup: await featureOn("group_sessions") };
}
