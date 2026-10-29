import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TodayPage } from "@/components/app/today";
import { AppHome } from "@/components/apps/app-home";
import AccessDeniedPage from "./acces-refuse/page";
import { appsSetupDone, visibleApps } from "@/server/apps";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { effectivePlan } from "@/server/plan";
import { SubscriptionSummary } from "@/components/apps/subscription-summary";

/** Apps rangées dans « Administration » (patron et admins), pas dans la grille des apps. */
const ADMIN_APPS = new Set(["employes", "reglages"]);

export async function generateMetadata(): Promise<Metadata> {
  // Le modèle « %s · Marque » du layout ne s'applique pas à la page du même dossier : titre complet ici.
  const brand = await currentBrand();
  return { title: { absolute: `${brand.id === "skydev" ? "Accueil" : "Aujourd'hui"} · ${brand.name}` } };
}

/** Branshee : l'accueil reste « Aujourd'hui » (app RDV). Skydev : l'accueil est le lanceur de toutes les apps. */
export default async function Page({ searchParams }: { searchParams: Promise<{ bienvenue?: string; pret?: string }> }) {
  const brand = await currentBrand();
  if (brand.id !== "skydev") {
    // Accueil RDV : refusé à un grade Skydev qui n'a pas l'app RDV (même en passant par l'autre adresse).
    const c = await requireContext();
    if (!c.canApp("rdv")) return <AccessDeniedPage />;
    return TodayPage({ searchParams });
  }
  const ctx = await requireContext();
  const canEdit = ctx.member.isOwner || ctx.can("settings.manage");
  // Première visite du responsable : questionnaire de départ pour choisir les apps de l'accueil.
  if (canEdit && !(await appsSetupDone(ctx.business.id))) redirect("/app/demarrer");
  const ready = !!(await searchParams).pret;
  // Administration : ce que le patron et ses admins gèrent pour toute l'entreprise (selon leurs droits).
  const admin = ([
    { href: "/app/reglages/etablissement", label: "Entreprise", hint: "Nom, adresse, logo", icon: "store", ok: ctx.can("business.manage") },
    // Équipe : membres et grades (droits par app) au même endroit, en onglets.
    { href: ctx.can("team.view") ? "/app/equipe" : "/app/equipe/grades", label: "Équipe", hint: "Employés, droits par app", icon: "team", ok: ctx.can("team.view") || ctx.can("grades.view") },
    { href: "/app/reglages/abonnement", label: "Abonnement", hint: "Formule, factures", icon: "card", ok: ctx.can("billing.manage") },
    { href: "/app/reglages/journal", label: "Journal", hint: "Qui a fait quoi", icon: "history", ok: ctx.can("logs.view") },
    { href: "/app/reglages", label: "Réglages", hint: "Paiements, SMS", icon: "settings", ok: ctx.can("settings.manage") },
  ] as const).filter((x) => x.ok).map(({ ok: _ok, ...x }) => x); // eslint-disable-line @typescript-eslint/no-unused-vars
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
      {ctx.can("billing.manage") ? (
        <Link href="/app/parrainage" className="group mx-auto mb-8 flex max-w-3xl items-center gap-4 rounded-2xl border border-accent/20 bg-accent-soft p-4 transition-colors duration-150 hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Gift className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-accent-soft-foreground sm:text-base">Invitez un pro, gagnez 1 mois offert</span>
            <span className="block text-sm text-accent-soft-foreground/80">Chaque personne qui s&apos;abonne grâce à vous = 29 € offerts sur votre abonnement.</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground group-hover:bg-accent-hover sm:inline-flex">Inviter<ArrowRight className="size-4" aria-hidden="true" /></span>
          <ArrowRight className="size-5 shrink-0 text-accent-soft-foreground sm:hidden" aria-hidden="true" />
        </Link>
      ) : null}
      <AppHome apps={apps.filter((a) => !ADMIN_APPS.has(a.id))} activeAddons={active} canEdit={canEdit} admin={admin} />
      {/* Essai ou abonnement absent : le bandeau du haut le dit déjà. */}
      {ctx.can("billing.manage") && (plan.source === "stripe" || plan.source === "account" || (plan.source === "granted" && !plan.isTrial)) ? (
        <div className="mx-auto mt-12 max-w-3xl">
          <SubscriptionSummary plan={{ plan: plan.plan, source: plan.source, isTrial: plan.isTrial, grantedUntil: plan.grantedUntil?.toISOString() ?? null, cancelAtPeriodEnd: plan.cancelAtPeriodEnd, periodEnd: plan.periodEnd?.toISOString() ?? null }} addons={active.length} />
        </div>
      ) : null}
    </>
  );
}
