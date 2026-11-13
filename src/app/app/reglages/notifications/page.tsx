import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";
import { redirect } from "next/navigation";
import { currentBrand } from "@/server/brand";

export const generateMetadata = appMetadata("Notifications · Réglages");

// Skydev : emails de rendez-vous propres à l'app RDV (RDV › Réglages › Emails aux clients). Branshee : inchangé.
export default async function NotificationsPage() {
  if ((await currentBrand()).id === "skydev") redirect("/app/rdv/parametres/notifications");
  return <BookingNotifications />;
}

export async function BookingNotifications() {
  const ctx = await requireContext("settings.manage");
  const [n] = await db.select().from(notificationSettings).where(eq(notificationSettings.businessId, ctx.business.id));
  return (
    <NotificationsForm
      n={{ reminderDelayHours: n!.reminderDelayHours, confirmationMessage: n!.confirmationMessage ?? "", reminderMessage: n!.reminderMessage ?? "", cancellationMessage: n!.cancellationMessage ?? "", emailOwnerOnNewBooking: n!.emailOwnerOnNewBooking, emailOwnerOnCancellation: n!.emailOwnerOnCancellation, reminderPaymentMethods: n!.reminderPaymentMethods, reminderPaymentNote: n!.reminderPaymentNote ?? "" }}
    />
  );
}
