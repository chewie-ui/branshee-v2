import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { redirect } from "next/navigation";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Modules");

export default async function Page() {
  const t = await appT();
  // Skydev : remplacé par le catalogue d'apps de l'accueil.
  if ((await currentBrand()).id === "skydev") redirect("/app");
  await requireContext();
  return (
    <UpcomingSection
      title={t("Modules")}
      description={t("Ajoutez des fonctionnalités à votre établissement.")}
      icon={<Blocks />}
      features={[
        t("Rappels par SMS et WhatsApp"),
        t("Paiement en ligne et acomptes"),
        t("Téléphone IA qui répond à vos appels"),
        t("Activation en un clic, facturé à l'abonnement"),
      ]}
    />
  );
}
