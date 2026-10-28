import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AssistantToggle } from "@/components/assistant/assistant-toggle";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { assistantAllowed, assistantEnabled } from "@/server/assistant";

export const metadata: Metadata = { title: "Assistant IA · Réglages" };

/** Activation de l'assistant IA (choix du responsable, pour toute l'équipe). */
export default async function AssistantSettingsPage() {
  const [ctx, brand] = await Promise.all([requireContext(), currentBrand()]);
  if (brand.id !== "skydev" || !assistantAllowed(ctx) || !(ctx.member.isOwner || ctx.can("settings.manage"))) notFound();
  const on = await assistantEnabled(ctx.business.id);
  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true"><Sparkles className="size-5" /></span>
        <div>
          <h2 className="text-lg font-semibold">Assistant IA</h2>
          <p className="mt-1 text-sm text-muted">Un bouton « Assistant » dans toutes vos apps : « qui ne m&apos;a pas payé ? », « combien j&apos;ai vendu en octobre ? », « prépare un devis pour Mme Dupont : 3 h de main-d&apos;œuvre à 45 € ».</p>
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Il lit vos clients, rendez-vous, factures, chiffres, stock et tâches, selon les droits de chaque membre.</li>
        <li>Il ne peut rien envoyer, émettre, encaisser ni supprimer : il prépare des brouillons que vous validez.</li>
        <li>Les questions et les données nécessaires à la réponse sont traitées par Anthropic, notre fournisseur d&apos;IA (sous-traitant), sans servir à entraîner ses modèles. Les notes et dossiers clients ne sont jamais transmis.</li>
        <li>Un nombre de questions par jour est inclus pour toute l&apos;équipe.</li>
      </ul>
      <AssistantToggle on={on} />
    </Card>
  );
}
