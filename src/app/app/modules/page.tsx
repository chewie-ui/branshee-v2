import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { redirect } from "next/navigation";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Modules");

export default async function Page() {
  // Skydev : remplacé par le catalogue d'apps de l'accueil.
  if ((await currentBrand()).id === "skydev") redirect("/app");
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
