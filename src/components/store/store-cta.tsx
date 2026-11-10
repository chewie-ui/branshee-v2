import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TRIAL_TEXT_L } from "@/components/store/store-parts";
import { localize, type SiteLocale } from "@/lib/site-locale";
import { getSessionUser } from "@/server/auth/session";

const T = {
  fr: { title: "Essayez toutes les apps gratuitement", inTitle: "Toutes ces apps sont déjà dans votre espace", inText: "Activez celles qui vous servent depuis l'App store. Et s'il vous manque une fonction, demandez-la : on la construit pour vous.", openApps: "Ouvrir mes apps", ask: "Demander une fonction sur mesure", text: "Puis un seul abonnement dès 29 € par mois, toutes les apps incluses, sans engagement. Et s'il vous manque quelque chose, on le construit.", signup: "Créer mon compte gratuit" },
  en: { title: "Try every app for free", inTitle: "All these apps are already in your space", inText: "Turn on the ones you need from the App store. And if a feature is missing, ask for it: we build it for you.", openApps: "Open my apps", ask: "Request a custom feature", text: "Then one subscription from €29 a month, every app included, no commitment. And if something's missing, we build it.", signup: "Create my free account" },
};

/** Bandeau final : essai gratuit + sur mesure. */
export async function StoreFooterCta({ title, locale = "fr" }: { title?: string; locale?: SiteLocale }) {
  const t = T[locale];
  // Déjà connecté : pas d'inscription, on renvoie vers l'espace et vers une demande sur mesure.
  if (await getSessionUser())
    return (
      <section className="mt-16 rounded-3xl bg-accent px-6 py-10 text-accent-foreground sm:px-10" aria-labelledby="essai">
        <h2 id="essai" className="text-2xl font-semibold tracking-tight text-balance">{t.inTitle}</h2>
        <p className="mt-2 max-w-prose text-accent-foreground/90">{t.inText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/apps" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 text-sm font-semibold hover:bg-surface-muted"><span className="inline-flex items-center gap-2 text-text">{t.openApps}<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
          <Link href="/app/sur-mesure" className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-5 text-sm font-semibold hover:bg-white/10"><span className="text-accent-foreground">{t.ask}</span></Link>
        </div>
      </section>
    );
  return (
    <section className="mt-16 rounded-3xl bg-accent px-6 py-10 text-accent-foreground sm:px-10" aria-labelledby="essai">
      <h2 id="essai" className="text-2xl font-semibold tracking-tight text-balance">{title ?? t.title}</h2>
      <p className="mt-2 max-w-prose text-accent-foreground/90">{TRIAL_TEXT_L[locale]}. {t.text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={localize("/inscription", locale)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 text-sm font-semibold hover:bg-surface-muted"><span className="inline-flex items-center gap-2 text-text">{t.signup}<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
        <Link href={localize("/#contact", locale)} className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-5 text-sm font-semibold hover:bg-white/10"><span className="text-accent-foreground">{t.ask}</span></Link>
      </div>
    </section>
  );
}
