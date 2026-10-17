import type { Metadata } from "next";
import { Users } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Équipe" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Équipe"
      description="Les membres de votre établissement et ce qu'ils peuvent faire."
      icon={<Users />}
      features={[
        "Membres : inviter, activer, retirer, profil public de chacun",
        "Grades et permissions : créer des rôles, choisir précisément les accès",
        "Invitations et demandes pour rejoindre l'établissement",
      ]}
    />
  );
}
