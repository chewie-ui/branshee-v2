import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TRIAL_TEXT } from "@/components/store/store-parts";
import { getSessionUser } from "@/server/auth/session";

/** Bandeau final : essai gratuit + sur mesure. */
export async function StoreFooterCta({ title = "Essayez toutes les apps gratuitement" }: { title?: string }) {
  // Déjà connecté : pas d'inscription, on renvoie vers l'espace et vers une demande sur mesure.
  if (await getSessionUser())
    return (
      <section className="mt-16 rounded-3xl bg-accent px-6 py-10 text-accent-foreground sm:px-10" aria-labelledby="essai">
        <h2 id="essai" className="text-2xl font-semibold tracking-tight text-balance">Toutes ces apps sont déjà dans votre espace</h2>
        <p className="mt-2 max-w-prose text-accent-foreground/90">Activez celles qui vous servent depuis « Toutes les apps ». Et s&apos;il vous manque une fonction, demandez-la : on la construit pour vous.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/apps" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 text-sm font-semibold hover:bg-surface-muted"><span className="inline-flex items-center gap-2 text-text">Ouvrir mes apps<ArrowRight className="size-4" aria-hidden="true" /></span></Link>
          <Link href="/app/sur-mesure" className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-5 text-sm font-semibold hover:bg-white/10"><span className="text-accent-foreground">Demander une fonction sur mesure</span></Link>
        </div>
      </section>
    );
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
