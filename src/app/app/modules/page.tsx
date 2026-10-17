import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Modules" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Modules"
      description="Ajoutez des fonctionnalités à votre établissement."
      icon={<Blocks />}
      features={[
        "Rappels par SMS et WhatsApp",
        "Paiement en ligne et acomptes",
        "Téléphone IA qui répond à vos appels",
        "Activation en un clic, facturé à l'abonnement",
      ]}
    />
  );
}
