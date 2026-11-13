import type { Metadata } from "next";
import { CreateBusinessForm } from "@/components/auth/create-business-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/context";
import { InvitationsAndJoin } from "@/components/memberships/memberships-panel";
import { listMemberships } from "@/server/memberships";
import { professionList } from "@/server/site";
import Link from "next/link";
import { currentBrand } from "@/server/brand";
import { AppLocaleProvider } from "@/components/app-locale";
import { makeT } from "@/lib/i18n/app";
import { countryOptions } from "@/lib/countries";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";

export const metadata: Metadata = { title: "Bienvenue" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  const sky = (await currentBrand()).id === "skydev";
  const [rows, professions] = await Promise.all([listMemberships(user.id), professionList({ allActivities: sky })]);
  const invited = rows.some((r) => r.status === "invited");
  // L'essai gratuit ne vaut que pour la 1re entreprise du compte (même supprimée depuis) : on le dit avant la création.
  const ownsOne = (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, user.id)).limit(1)).length > 0;
  const locale = user.locale ?? "fr";
  const t = makeT(locale);
  return (
    <AppLocaleProvider locale={locale}>
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t("Bienvenue {name}", { name: user.name.split(" ")[0] ?? "" })}</h1>
      <p className="mt-1 text-center text-sm text-muted">{sky ? t("Créons l'espace de votre entreprise. Tout se modifie ensuite.") : "Créons votre établissement. Tout se modifie ensuite."}</p>
      {invited ? <div className="mt-6"><InvitationsAndJoin brandName={sky ? "Skydev" : "Branshee"} rows={rows.filter((r) => r.status !== "active")} /></div> : null}
      {sky && ownsOne ? (
        <p className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm" role="note">
          {t("L'essai gratuit d'un mois vaut pour une seule entreprise : il a déjà servi pour votre première. Chaque entreprise a son propre abonnement (dès 29 € par mois, toutes les apps) : cette nouvelle entreprise sera en lecture seule jusqu'à son abonnement.")}
        </p>
      ) : null}
      <Card className="mt-6 p-6">
        <CreateBusinessForm professions={professions} company={sky} countries={countryOptions(locale)} />
      </Card>
      {!invited ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-center text-sm font-medium text-accent">{sky ? t("Vous rejoignez une entreprise déjà sur Skydev ?") : "Vous rejoignez un établissement existant ?"}</summary>
          <div className="mt-4"><InvitationsAndJoin brandName={sky ? "Skydev" : "Branshee"} rows={rows.filter((r) => r.status !== "active")} /></div>
        </details>
      ) : null}
      {sky ? (
        <p className="mt-4 text-center text-sm text-muted">
          {t("Vous n'êtes pas une entreprise ?")}{" "}
          <Link href="/espace-client" className="font-medium text-accent hover:text-accent-hover">{t("Aller à mon espace client")}</Link>
        </p>
      ) : null}
    </AppLocaleProvider>
  );
}
