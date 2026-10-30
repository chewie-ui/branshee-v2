import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { ButtonLink } from "@/components/ui/button";
import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { appById } from "@/lib/apps";
import { eur } from "@/lib/plans";
import { SKYDEV_ADDONS } from "@/lib/skydev-plans";
import { requireContext } from "@/server/context";

const app = appById("tel-ia");

export const metadata: Metadata = { title: app.name };

export default async function Page() {
  const ctx = await requireContext();
  const [active] = await db.select({ at: businessModules.activatedAt }).from(businessModules).where(and(eq(businessModules.businessId, ctx.business.id), eq(businessModules.moduleKey, "tel_ia")));
  if (active)
    return (
      <AppPlaceholder
        app={app}
        title="Tél IA est actif sur votre abonnement"
        text="On vous contacte pour le configurer ensemble : ce que l'IA doit dire (services, horaires, questions fréquentes) et le renvoi de vos appels manqués. Une question en attendant ? Appelez-nous."
        action={<ButtonLink href="tel:+32477443988" variant="secondary">Nous appeler : 0477 44 39 88</ButtonLink>}
      />
    );
  return (
    <AppPlaceholder
      app={app}
      title={`Option à ${eur(SKYDEV_ADDONS.tel_ia.monthly)} TVAC par mois`}
      text={`${SKYDEV_ADDONS.tel_ia.description} Ajoutez-la à votre abonnement, puis on configure ensemble ce que l'IA doit dire.`}
      action={
        <>
          {ctx.can("billing.manage") ? <ButtonLink href="/app/reglages/abonnement">Ajouter à mon abonnement</ButtonLink> : null}
          <ButtonLink href="tel:+32477443988" variant="secondary">Nous appeler : 0477 44 39 88</ButtonLink>
        </>
      }
    />
  );
}
