import type { DirMetier, DirVille } from "@/lib/directory";

/** Questions de clients (texte vrai pour tous les pros de l'annuaire), aussi en données structurées. */
export function faqFor(metier: DirMetier, ville?: DirVille) {
  const lieu = ville ? ` à ${ville.nom}` : "";
  return [
    { q: `Comment prendre rendez-vous chez un ${metier.nom}${lieu} ?`, r: `Choisissez un ${metier.nom} dans la liste, ouvrez sa page, puis sélectionnez la prestation et le créneau qui vous conviennent. Vous recevez la confirmation par e-mail, avec un rappel avant le rendez-vous.` },
    { q: "Faut-il créer un compte pour réserver ?", r: "Non. Votre nom, votre e-mail et votre téléphone suffisent. Le compte client est facultatif : il sert à retrouver vos rendez-vous et vos cartes de fidélité." },
    { q: "La réservation est-elle payante ?", r: "La réservation elle-même ne coûte rien. Certains professionnels demandent un acompte ou une empreinte de carte : c'est toujours indiqué avant de confirmer." },
    { q: "Et si je dois annuler ?", r: "Le lien d'annulation se trouve dans l'e-mail de confirmation. Les conditions d'annulation de chaque professionnel sont affichées sur sa page." },
  ];
}

export function DirectoryFaq({ items }: { items: { q: string; r: string }[] }) {
  return (
    <section className="mt-16" aria-labelledby="faq-titre">
      <h2 id="faq-titre" className="text-xl font-semibold tracking-tight">Questions fréquentes</h2>
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
        {items.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="cursor-pointer list-none font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <span className="flex items-center justify-between gap-4">{f.q}<span className="text-muted transition-transform duration-150 group-open:rotate-45" aria-hidden="true">+</span></span>
            </summary>
            <p className="mt-2 max-w-prose text-sm text-muted">{f.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
