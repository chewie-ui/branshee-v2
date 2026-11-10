import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Accès refusé");

export default async function AccessDeniedPage() {
  const t = await appT();
  return (
    <Card className="mx-auto mt-8 max-w-lg">
      <EmptyState
        icon={<Lock />}
        title={t("Vous n'avez pas accès à cette section")}
        description={t("Votre grade ne permet pas d'ouvrir cette page. Demandez au responsable de l'établissement de modifier vos permissions.")}
        action={<ButtonLink href="/app" variant="secondary">{t("Retour à l'accueil")}</ButtonLink>}
      />
    </Card>
  );
}
