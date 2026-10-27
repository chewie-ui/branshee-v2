import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { requireContext } from "@/server/context";

const app = appById("employes");

export const metadata: Metadata = { title: "Congés" };

export default async function Page() {
  const ctx = await requireContext();
  return (
    <AppPlaceholder
      app={{ ...app, status: "soon" }}
      title="Les congés arrivent bientôt"
      text="Demandes de congés, validation en un clic et soldes de chaque employé, liés aux apps Planning et Paie. En attendant, gérez vos collaborateurs et leurs accès dans Équipe."
      action={ctx.can("team.view") ? <ButtonLink href="/app/equipe" variant="secondary">Ouvrir Équipe</ButtonLink> : undefined}
    />
  );
}
