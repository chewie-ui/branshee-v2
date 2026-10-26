import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { requireContext } from "@/server/context";

const app = appById("tel-ia");

export const metadata: Metadata = { title: app.name };

export default async function Page() {
  await requireContext();
  return <AppPlaceholder app={app} title="Option activée sur demande" text="Tél IA s'ajoute à votre abonnement. On configure ensemble ce que l'IA doit dire (services, horaires, questions fréquentes), puis vos appels manqués sont pris en charge." action={<><ButtonLink href="mailto:info@skydev.be?subject=Activer%20T%C3%A9l%20IA">Demander l&apos;activation</ButtonLink><ButtonLink href="tel:+32477443988" variant="secondary">0477 44 39 88</ButtonLink></>} />;
}
