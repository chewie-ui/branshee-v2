import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AssistantToggle } from "@/components/assistant/assistant-toggle";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { assistantAllowed, assistantEnabled } from "@/server/assistant";
import { appT, appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Assistant IA · Réglages");

/** Activation de l'assistant IA (choix du responsable, pour toute l'équipe). */
export default async function AssistantSettingsPage() {
  const t = await appT();
  const [ctx, brand] = await Promise.all([requireContext(), currentBrand()]);
  if (brand.id !== "skydev" || !(await assistantAllowed(ctx)) || !(ctx.member.isOwner || ctx.can("settings.manage"))) notFound();
  const on = await assistantEnabled(ctx.business.id);
  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true"><Sparkles className="size-5" /></span>
        <div>
          <h2 className="text-lg font-semibold">Assistant IA</h2>
          <p className="mt-1 text-sm text-muted">{t("Un bouton « Assistant » dans toutes vos apps : « qui ne m'a pas payé ? », « combien j'ai vendu en octobre ? », « prépare un devis pour Mme Dupont : 3 h de main-d'œuvre à 45 € ».")}</p>
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>{t("Il lit vos clients, rendez-vous, factures, chiffres, stock et tâches, selon les droits de chaque membre.")}</li>
        <li>{t("Il ne peut rien envoyer, émettre, encaisser ni supprimer : il prépare des brouillons que vous validez.")}</li>
        <li>{t("Les questions et les données nécessaires à la réponse sont traitées par Anthropic, notre fournisseur d'IA (sous-traitant), sans servir à entraîner ses modèles. Les notes et dossiers clients ne sont jamais transmis.")}</li>
        <li>{t("Inclus dans l'abonnement Skydev (quelques questions par jour pendant l'essai).")}</li>
        <li>{t("Interdit aux professions de santé : aucune donnée de patient ne doit partir chez un fournisseur d'IA.")}</li>
      </ul>
      <AssistantToggle on={on} />
    </Card>
  );
}
