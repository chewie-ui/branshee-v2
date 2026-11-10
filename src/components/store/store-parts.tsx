import Link from "next/link";
import { ArrowRight, Check, Globe2, WandSparkles } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import { BILLING_LABEL, type SkyApp } from "@/lib/apps";
import { APP_REACH, BILLING_LABEL_EN, REACH_LABEL } from "@/lib/apps-i18n";
import { storeHrefL } from "@/lib/app-store-i18n";
import { TRIAL_DAYS } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { localize, type SiteLocale } from "@/lib/site-locale";
import type { StoreApp } from "@/lib/app-store";

/** Texte de l'essai gratuit (30 jours = « 1 mois »). */
export const TRIAL_TEXT = TRIAL_DAYS === 30 ? "1 mois offert, sans carte bancaire" : `${TRIAL_DAYS} jours offerts, sans carte bancaire`;
export const TRIAL_TEXT_L: Record<SiteLocale, string> = { fr: TRIAL_TEXT, en: TRIAL_DAYS === 30 ? "First month free, no credit card" : `${TRIAL_DAYS} days free, no credit card` };

const BADGE: Record<SkyApp["billing"], string> = {
  included: "bg-success-soft text-success",
  addon: "bg-accent-soft text-accent-soft-foreground",
  quote: "bg-warning-soft text-warning",
  system: "",
};

export function BillingBadge({ billing, locale = "fr" }: { billing: SkyApp["billing"]; locale?: SiteLocale }) {
  if (billing === "system") return null;
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[billing])}>{(locale === "en" ? BILLING_LABEL_EN : BILLING_LABEL)[billing]}</span>;
}

/** Zone où l'app fonctionne (affichée en anglais : le public international doit savoir ce qui est réservé à la Belgique). */
export function ReachBadge({ id, locale }: { id: SkyApp["id"]; locale: SiteLocale }) {
  const reach = APP_REACH[id];
  if (locale !== "en" || reach === "world") return null;
  return <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning"><Globe2 className="size-3" aria-hidden="true" />{REACH_LABEL.en[reach]}</span>;
}

export function AppTile({ app, store, note, locale = "fr" }: { app: SkyApp; store: StoreApp; note?: string; locale?: SiteLocale }) {
  return (
    <Link href={storeHrefL(app.id, locale)} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <span className="flex items-start justify-between gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground"><AppIcon icon={app.icon} /></span>
        <span className="flex flex-wrap justify-end gap-1.5"><ReachBadge id={app.id} locale={locale} /><BillingBadge billing={app.billing} locale={locale} /></span>
      </span>
      <span className="mt-4 font-semibold">{app.name}</span>
      <span className="mt-1 text-sm text-muted">{note ?? app.tagline}</span>
      {store.tags.length ? (
        <span className="mt-3 flex flex-wrap gap-1.5">
          {store.tags.slice(0, 3).map((t) => <span key={t} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-muted">{t}</span>)}
          {store.tags.length > 3 ? <span className="px-1 py-0.5 text-xs text-muted">+{store.tags.length - 3}</span> : null}
        </span>
      ) : null}
      <span className="flex-1" />
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium"><span className="text-accent group-hover:underline">{locale === "en" ? "Learn more" : "Découvrir"}</span><ArrowRight className="size-4 text-accent" aria-hidden="true" /></span>
    </Link>
  );
}

const CUSTOM = {
  fr: { title: "Votre app n'existe pas ?", text: "Décrivez la fonction qui vous manque : on l'ajoute à votre espace, reliée à vos clients et à vos données. Prix fixe annoncé avant de commencer.", cta: "Décrire mon besoin", more: "Le sur mesure" },
  en: { title: "Can't find your app?", text: "Describe the feature you need: we add it to your space, connected to your clients and data. Fixed price agreed before we start.", cta: "Describe my need", more: "Custom work" },
};

/** Carte « il vous manque une fonction » : mise en avant du sur mesure, à la fin de chaque liste d'apps. */
export function CustomTile({ ideas, locale = "fr" }: { ideas?: string[]; locale?: SiteLocale }) {
  const t = CUSTOM[locale];
  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft/40 p-5">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><WandSparkles className="size-5" aria-hidden="true" /></span>
      <span className="mt-4 font-semibold">{t.title}</span>
      <span className="mt-1 text-sm text-muted">{t.text}</span>
      {ideas?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {ideas.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{i}</li>)}
        </ul>
      ) : null}
      <span className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link href={localize("/#contact", locale)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"><span className="text-accent-foreground">{t.cta}</span></Link>
        <Link href={localize("/sur-mesure", locale)} className="inline-flex min-h-10 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-muted"><span>{t.more}</span></Link>
      </span>
    </div>
  );
}
