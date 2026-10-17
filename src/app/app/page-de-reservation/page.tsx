import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Page de réservation" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Page de réservation"
      description="La page où vos clients réservent en ligne."
      icon={<Globe />}
      features={[
        "Aperçu en direct de la page",
        "Contenu : à propos, galerie, FAQ, équipements, sections affichées",
        "Apparence : couleurs, police, arrondis",
        "Formulaire posé avant chaque réservation",
        "Partager : lien, QR code, intégration sur votre site",
      ]}
    />
  );
}
