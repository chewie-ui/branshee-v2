"use client";

import { useRouter } from "next/navigation";
import { Info, Play } from "lucide-react";
import { startTour } from "@/components/app/guided-tour";
import { Button } from "@/components/ui/button";

/** Écran de bienvenue juste après la création de l'établissement : propose la visite guidée. */
export function WelcomeCard({ firstName }: { firstName: string }) {
  const router = useRouter();
  return (
    <div className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft/50 px-6 py-8 text-center">
      <p className="text-4xl" aria-hidden="true">🎉</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Bienvenue sur Branshee, {firstName} !</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">On configure votre établissement ensemble : on vous montre exactement où cliquer, étape par étape. Ça prend moins de 5 minutes.</p>
      <div className="mt-5 flex flex-col items-center gap-3">
        <Button icon={<Play className="size-4" aria-hidden="true" />} onClick={() => { router.replace("/app"); startTour("onboarding"); }}>
          Commencer la visite guidée
        </Button>
        <button type="button" onClick={() => router.replace("/app")} className="text-sm text-muted hover:text-text hover:underline">
          Plus tard, j&apos;irai directement à mon tableau de bord
        </button>
      </div>
      <p className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 text-xs text-muted">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Horaires, première prestation puis couleurs de votre page. Vous pourrez la relancer depuis « Aide et support ».
      </p>
    </div>
  );
}
