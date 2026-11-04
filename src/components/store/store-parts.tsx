import Link from "next/link";
import { ArrowRight, Check, WandSparkles } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import { BILLING_LABEL, type SkyApp } from "@/lib/apps";
import { TRIAL_DAYS } from "@/lib/plans";
import { cn } from "@/lib/cn";
import type { StoreApp } from "@/lib/app-store";

/** Texte de l'essai gratuit (30 jours = « 1 mois »). */
export const TRIAL_TEXT = TRIAL_DAYS === 30 ? "1 mois offert, sans carte bancaire" : `${TRIAL_DAYS} jours offerts, sans carte bancaire`;

const BADGE: Record<SkyApp["billing"], string> = {
  included: "bg-success-soft text-success",
  addon: "bg-accent-soft text-accent-soft-foreground",
  quote: "bg-warning-soft text-warning",
  system: "",
};

export function BillingBadge({ billing }: { billing: SkyApp["billing"] }) {
  if (billing === "system") return null;
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[billing])}>{BILLING_LABEL[billing]}</span>;
}

export function AppTile({ app, store, note }: { app: SkyApp; store: StoreApp; note?: string }) {
  return (
    <Link href={`/apps/${store.slug}`} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <span className="flex items-start justify-between gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground"><AppIcon icon={app.icon} /></span>
        <BillingBadge billing={app.billing} />
      </span>
      <span className="mt-4 font-semibold">{app.name}</span>
      <span className="mt-1 flex-1 text-sm text-muted">{note ?? app.tagline}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium"><span className="text-accent group-hover:underline">Découvrir</span><ArrowRight className="size-4 text-accent" aria-hidden="true" /></span>
    </Link>
  );
}

/** Carte « il vous manque une fonction » : mise en avant du sur mesure, à la fin de chaque liste d'apps. */
export function CustomTile({ ideas }: { ideas?: string[] }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft/40 p-5">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><WandSparkles className="size-5" aria-hidden="true" /></span>
      <span className="mt-4 font-semibold">Votre app n&apos;existe pas ?</span>
      <span className="mt-1 text-sm text-muted">Décrivez la fonction qui vous manque : on l&apos;ajoute à votre espace, reliée à vos clients et à vos données. Prix fixe annoncé avant de commencer.</span>
      {ideas?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {ideas.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{i}</li>)}
        </ul>
      ) : null}
      <span className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link href="/#contact" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"><span className="text-accent-foreground">Décrire mon besoin</span></Link>
        <Link href="/sur-mesure" className="inline-flex min-h-10 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-muted"><span>Le sur mesure</span></Link>
      </span>
    </div>
  );
}

/** Bandeau final : essai gratuit + sur mesure. */
export function StoreFooterCta({ title = "Essayez toutes les apps gratuitement" }: { title?: string }) {
  return (
    <section className="mt-16 rounded-3xl bg-accent px-6 py-10 text-accent-foreground sm:px-10" aria-labelledby="essai">
      <h2 id="essai" className="text-2xl font-semibold tracking-tight text-balance">{title}</h2>
      <p className="mt-2 max-w-prose text-accent-foreground/90">{TRIAL_TEXT}. Un seul abonnement dès 29 € par mois, toutes les apps incluses, sans engagement. Et s&apos;il vous manque quelque chose, on le construit.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/inscription" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 text-sm font-semibold hover:bg-surface-muted"><span className="inline-flex items-center gap-2 text-text">Créer mon compte gratuit<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
        <Link href="/#contact" className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-5 text-sm font-semibold hover:bg-white/10"><span className="text-accent-foreground">Demander une fonction sur mesure</span></Link>
      </div>
    </section>
  );
}
