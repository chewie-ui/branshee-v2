import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Gift, ShoppingBag } from "lucide-react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { DirectorySearch } from "@/components/directory/directory-search";
import { getSessionUser } from "@/server/auth/session";
import { currentBrand } from "@/server/brand";
import { directoryVocabulary } from "@/server/directory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Espace client · Skydev — vos rendez-vous, commandes et cartes de fidélité" },
  description: "Trouvez un professionnel près de chez vous, réservez en ligne 24 h/24, et retrouvez vos rendez-vous, vos commandes et vos cartes de fidélité au même endroit.",
  alternates: { canonical: "https://client.skydev.be" },
};

const FEATURES = [
  { icon: CalendarCheck, title: "Vos rendez-vous", text: "Tous vos rendez-vous, chez tous vos pros. Déplacez ou annulez en un clic, ajoutez-les à votre agenda." },
  { icon: Gift, title: "Vos cartes de fidélité", text: "Fini les cartes en carton : vos tampons sont sur votre téléphone, et la récompense arrive toute seule." },
  { icon: ShoppingBag, title: "Vos commandes", text: "Commandez en ligne, passez récupérer : le suivi et le code de retrait sont ici." },
];

/** client.skydev.be pour un visiteur non connecté : la page d'accueil des particuliers. */
export default async function ClientHome() {
  const [session, brand, vocab] = await Promise.all([getSessionUser(), currentBrand(), directoryVocabulary()]);
  const signup = "/inscription?client=1&suite=%2Fespace-client";
  const login = "/connexion?suite=%2Fespace-client";
  const pros = brand.id === "skydev" ? "https://skydev.be" : "/";
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label={`${brand.name} — espace client`}><Brand brand={brand.id} /></Link>
          <nav aria-label="Compte" className="ml-auto flex items-center gap-2">
            {session ? (
              <ButtonLink href="/espace-client" size="sm">Mon espace</ButtonLink>
            ) : (
              <>
                <ButtonLink href={login} variant="ghost" size="sm">Se connecter</ButtonLink>
                <ButtonLink href={signup} size="sm">Créer mon compte</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="contenu" className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20">
          <p className="text-sm font-medium text-accent">Espace client</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Vos rendez-vous, vos commandes et vos cartes de fidélité. Au même endroit.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">Trouvez un pro près de chez vous, réservez en ligne 24 h/24, et retrouvez tout dans votre espace. Gratuit, sans application à installer.</p>
          <div className="mt-8 text-left">
            <DirectorySearch metiers={vocab.metierNames} villes={vocab.villeNames} big />
          </div>
        </section>

        <section aria-label="Ce que vous retrouvez dans votre espace" className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
          <ul className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><f.icon className="size-5" aria-hidden="true" /></span>
                <h2 className="mt-4 font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {session ? null : (
          <section className="border-t border-border bg-surface">
            <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Déjà réservé chez un pro sur {brand.name} ?</h2>
                <p className="mt-1 text-sm text-muted">Créez votre compte avec le même email : vos rendez-vous, commandes et cartes apparaissent tout seuls.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={signup}>Créer mon compte</ButtonLink>
                <ButtonLink href={login} variant="secondary">Se connecter</ButtonLink>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <Link href="/conditions-utilisation" className="hover:text-text">Conditions</Link>
          <Link href="/confidentialite" className="hover:text-text">Confidentialité</Link>
          <a href={pros} className="ml-auto font-medium text-accent hover:text-accent-hover">Vous êtes un professionnel ?</a>
        </div>
      </footer>
    </div>
  );
}
