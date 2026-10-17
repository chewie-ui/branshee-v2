import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Mon compte" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Mon compte"
      description="Vos informations personnelles."
      icon={<UserRound />}
      features={[
        "Profil, email et mot de passe",
        "Double authentification",
        "Langue de l'interface",
        "Suppression du compte",
      ]}
    />
  );
}
