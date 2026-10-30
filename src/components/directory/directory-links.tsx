import Link from "next/link";
import { cap, knownMetiers, metierUrl, metierVilleUrl, type DirMetier, type DirVille } from "@/lib/directory";

/** Liens internes « métier » et « métier à ville » : aident Google à trouver toutes les pages de l'annuaire. */
export function DirectoryLinks({ metier, villes, title }: { metier?: DirMetier; villes: DirVille[]; title?: string }) {
  return (
    <section className="mt-16 grid gap-8 border-t border-border pt-10 sm:grid-cols-2" aria-label="Parcourir l'annuaire">
      <div>
        <h2 className="text-base font-semibold">Par métier</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {knownMetiers().map((m) => (
            <li key={m.slug}>
              <Link href={metierUrl(m.slug)} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">{cap(m.pluriel)}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-base font-semibold">{title ?? (metier ? `${cap(metier.pluriel)} par ville` : "Par ville")}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link href={metier ? metierVilleUrl(metier.slug, v.slug) : `/annuaire?ou=${encodeURIComponent(v.nom)}`} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">
                {metier ? `${cap(metier.nom)} à ${v.nom}` : v.nom}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Encadré pour les pros : être trouvé là où les clients cherchent. */
export function ProCallout({ brandName, metier, ville }: { brandName: string; metier?: DirMetier; ville?: DirVille }) {
  const who = metier ? `${metier.nom}${ville ? ` à ${ville.nom}` : ""}` : "professionnel";
  return (
    <aside className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-accent/20 bg-accent-soft p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-accent-soft-foreground">Vous êtes {who} ?</p>
        <p className="mt-1 text-sm text-accent-soft-foreground/85">Apparaissez ici et recevez des réservations de nouveaux clients, 24 h/24. Votre page se crée avec votre compte {brandName}, essai gratuit sans carte.</p>
      </div>
      <Link href="/inscription" className="inline-flex h-11 shrink-0 items-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span className="text-accent-foreground">Créer ma page</span></Link>
    </aside>
  );
}
