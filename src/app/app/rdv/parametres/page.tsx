import { BookingRules } from "@/app/app/reglages/reservation/page";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Règles de réservation · RDV");

export default function RdvRulesPage() {
  return <BookingRules />;
}
