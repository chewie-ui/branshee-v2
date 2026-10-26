import type { Metadata } from "next";

import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { requireContext } from "@/server/context";

const app = appById("employes");

export const metadata: Metadata = { title: app.name };

export default async function Page() {
  await requireContext();
  return <AppPlaceholder app={app} title="Arrive bientôt dans votre abonnement" text="Employés sera incluse dans votre abonnement, sans supplément. Le planning de l'équipe sera lié à l'agenda RDV." />;
}
