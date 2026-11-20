import { requireContext } from "@/server/context";
import { appMetadata } from "@/server/app-locale";
import { PersonalizationForm } from "@/components/settings/personalization-form";

export const generateMetadata = appMetadata("Personnalisation");

/** Personnalisation de l'espace pro : propre à chaque utilisateur, ouverte à tous les membres. */
export default async function PersonalizationPage() {
  await requireContext();
  return <PersonalizationForm />;
}
