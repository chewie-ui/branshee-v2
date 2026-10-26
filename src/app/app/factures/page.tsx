import type { Metadata } from "next";

import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { requireContext } from "@/server/context";

const app = appById("factures");

export const metadata: Metadata = { title: app.name };

export default async function Page() {
  await requireContext();
  return <AppPlaceholder app={app} title="Arrive bientôt dans votre abonnement" text="Factures sera incluse dans votre abonnement, sans supplément. Elle utilisera votre fichier clients : un client pris en rendez-vous se facture en un clic." />;
}
