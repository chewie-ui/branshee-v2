import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { requireContext } from "@/server/context";

const app = appById("sur-mesure");

export const metadata: Metadata = { title: app.name };

export default async function Page() {
  await requireContext();
  return <AppPlaceholder app={app} title="Dites-nous exactement ce que vous voulez" text="Un site plus ambitieux, une boutique complète, une app pour votre métier : on en parle 15 minutes, vous voyez une maquette, puis vous recevez un prix fixe. Ce qui est construit rejoint vos autres apps, sur la même facture." action={<><ButtonLink href="mailto:info@skydev.be?subject=Projet%20sur%20mesure">Décrire mon projet</ButtonLink><ButtonLink href="tel:+32477443988" variant="secondary">0477 44 39 88</ButtonLink></>} />;
}
