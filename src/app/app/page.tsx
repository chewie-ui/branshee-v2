import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TodayPage } from "@/components/app/today";
import { AppHome } from "@/components/apps/app-home";
import { appsSetupDone, visibleApps } from "@/server/apps";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { effectivePlan } from "@/server/plan";
import { SubscriptionSummary } from "@/components/apps/subscription-summary";

export async function generateMetadata(): Promise<Metadata> {
  // Le modèle « %s · Marque » du layout ne s'applique pas à la page du même dossier : titre complet ici.
  const brand = await currentBrand();
  return { title: { absolute: `${brand.id === "skydev" ? "Accueil" : "Aujourd'hui"} · ${brand.name}` } };
}

/** Branshee : l'accueil reste « Aujourd'hui » (app RDV). Skydev : l'accueil est le lanceur de toutes les apps. */
export default async function Page({ searchParams }: { searchParams: Promise<{ bienvenue?: string; pret?: string }> }) {
  const brand = await currentBrand();
  if (brand.id !== "skydev") return TodayPage({ searchParams });
  const ctx = await requireContext();
  const canEdit = ctx.member.isOwner || ctx.can("settings.manage");
  // Première visite du responsable : questionnaire de départ pour choisir les apps de l'accueil.
  if (canEdit && !(await appsSetupDone(ctx.business.id))) redirect("/app/demarrer");
  const ready = !!(await searchParams).pret;
  const firstName = ctx.user.name.split(" ")[0];
  const [plan, mods, apps] = await Promise.all([
    effectivePlan(ctx.business.id),
    db.select({ key: businessModules.moduleKey }).from(businessModules).where(eq(businessModules.businessId, ctx.business.id)),
    visibleApps(ctx),
  ]);
  // Clés de module (tel_ia) → identifiants d'app (tel-ia).
  const active = mods.map((m) => m.key.replace(/_/g, "-"));
  return (
    <>
      <div className="mt-2 mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bonjour {firstName}</h1>
        <p className="mt-1 text-sm text-muted">{ready ? "Votre espace est prêt. Ouvrez une app pour commencer." : `Les apps de ${ctx.business.name}.`}</p>
      </div>
      <AppHome apps={apps} activeAddons={active} canEdit={canEdit} />
      {/* Essai ou abonnement absent : le bandeau du haut le dit déjà. */}
      {ctx.can("billing.manage") && (plan.source === "stripe" || plan.source === "account" || (plan.source === "granted" && !plan.isTrial)) ? (
        <div className="mx-auto mt-12 max-w-3xl">
          <SubscriptionSummary plan={{ plan: plan.plan, source: plan.source, isTrial: plan.isTrial, grantedUntil: plan.grantedUntil?.toISOString() ?? null, cancelAtPeriodEnd: plan.cancelAtPeriodEnd, periodEnd: plan.periodEnd?.toISOString() ?? null }} addons={active.length} />
        </div>
      ) : null}
    </>
  );
}
