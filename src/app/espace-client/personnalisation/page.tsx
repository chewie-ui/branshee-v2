import type { Metadata } from "next";
import { requireClient } from "@/server/client-account";
import { PersonalizationForm } from "@/components/settings/personalization-form";

export const metadata: Metadata = { title: "Personnalisation" };

/** Thème, couleur, curseur et confort de l'espace client (gardés sur le compte, sur tous les appareils). */
export default async function ClientPersonalizationPage() {
  await requireClient("/espace-client/personnalisation");
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Personnalisation</h1>
      <p className="mt-1 mb-6 text-muted">Thème, couleur, curseur et confort de lecture de votre espace.</p>
      <PersonalizationForm notifications={false} />
    </div>
  );
}
