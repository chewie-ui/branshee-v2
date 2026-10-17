import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Notifications · Réglages" };

export default async function NotificationsPage() {
  const ctx = await requireContext("settings.manage");
  const [n] = await db.select().from(notificationSettings).where(eq(notificationSettings.businessId, ctx.business.id));
  return (
    <NotificationsForm
      n={{ reminderDelayHours: n!.reminderDelayHours, confirmationMessage: n!.confirmationMessage ?? "", reminderMessage: n!.reminderMessage ?? "", cancellationMessage: n!.cancellationMessage ?? "", emailOwnerOnNewBooking: n!.emailOwnerOnNewBooking, emailOwnerOnCancellation: n!.emailOwnerOnCancellation }}
    />
  );
}
