import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Site web" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Site web"
      description="Un site vitrine relié à vos réservations."
      icon={<LayoutTemplate />}
      features={[
        "Modèles prêts à l'emploi",
        "Sections : accueil, prestations, réservation, galerie, avis, contact",
        "Nom de domaine personnalisé et référencement",
      ]}
    />
  );
}
