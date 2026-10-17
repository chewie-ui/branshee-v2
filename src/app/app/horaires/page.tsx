import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Horaires" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Horaires"
      description="Quand vous et votre équipe êtes disponibles."
      icon={<Clock />}
      features={[
        "Horaires de la semaine, plusieurs plages par jour",
        "Horaires communs ou différents pour chaque membre",
        "Congés, fermetures et horaires exceptionnels à une date",
      ]}
    />
  );
}
