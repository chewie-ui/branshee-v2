import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TodayPage } from "@/components/app/today";
import { AppLauncher } from "@/components/apps/app-launcher";
import { PageHeader } from "@/components/ui/page-header";
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
export default async function Page({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const brand = await currentBrand();
  if (brand.id !== "skydev") return TodayPage({ searchParams });
  if ((await searchParams).bienvenue) redirect("/app/rdv?bienvenue=1");
  const ctx = await requireContext();
  const firstName = ctx.user.name.split(" ")[0];
  const [plan, mods] = await Promise.all([effectivePlan(ctx.business.id), db.select({ key: businessModules.moduleKey }).from(businessModules).where(eq(businessModules.businessId, ctx.business.id))]);
  // Clés de module (tel_ia) → identifiants d'app (tel-ia).
  const active = mods.map((m) => m.key.replace(/_/g, "-"));
  return (
    <>
      <PageHeader title={`Bonjour ${firstName}`} description={`Toutes les apps de ${ctx.business.name}, au même endroit.`} />
      {/* Essai ou abonnement absent : le bandeau du haut le dit déjà. */}
      {ctx.can("billing.manage") && (plan.source === "stripe" || plan.source === "account" || (plan.source === "granted" && !plan.isTrial)) ? <SubscriptionSummary plan={{ plan: plan.plan, source: plan.source, isTrial: plan.isTrial, grantedUntil: plan.grantedUntil?.toISOString() ?? null, cancelAtPeriodEnd: plan.cancelAtPeriodEnd, periodEnd: plan.periodEnd?.toISOString() ?? null }} addons={active.length} /> : null}
      <AppLauncher activeAddons={active} />
    </>
  );
}
