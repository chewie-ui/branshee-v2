import { BookingNotifications } from "@/app/app/reglages/notifications/page";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Emails aux clients · RDV");

export default function RdvNotificationsPage() {
  return <BookingNotifications />;
}
