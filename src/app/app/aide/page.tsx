import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { UpcomingSection } from "@/components/app/upcoming-section";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Aide et support" };

export default async function Page() {
  await requireContext();
  return (
    <UpcomingSection
      title="Aide et support"
      description="Une question ? On vous répond."
      icon={<LifeBuoy />}
      features={[
        "Discussion directe avec l'équipe Branshee",
        "Vidéos et questions fréquentes",
      ]}
    />
  );
}
