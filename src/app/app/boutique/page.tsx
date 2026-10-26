import type { Metadata } from "next";

import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { requireContext } from "@/server/context";

const app = appById("boutique");

export const metadata: Metadata = { title: app.name };

export default async function Page() {
  await requireContext();
  return <AppPlaceholder app={app} title="Arrive bientôt dans votre abonnement" text="Boutique sera incluse dans votre abonnement pour vendre vos produits depuis votre site. Pour une grosse boutique dès maintenant, passez par l'app Sur mesure." />;
}
