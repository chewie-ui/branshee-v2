import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Accès refusé" };

export default function AccessDeniedPage() {
  return (
    <Card className="mx-auto mt-8 max-w-lg">
      <EmptyState
        icon={<Lock />}
        title="Vous n'avez pas accès à cette section"
        description="Votre grade ne permet pas d'ouvrir cette page. Demandez au responsable de l'établissement de modifier vos permissions."
        action={<ButtonLink href="/app" variant="secondary">Retour à l&apos;accueil</ButtonLink>}
      />
    </Card>
  );
}
