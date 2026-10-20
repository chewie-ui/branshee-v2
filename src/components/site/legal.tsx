import type { ReactNode } from "react";

/** Mise en page des pages légales : sommaire + sections numérotées. */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { id: string; title: string; body: ReactNode }[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted">Dernière mise à jour : {updated} — Branshee, Belgique</p>
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Sommaire" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold">Sommaire</p>
          <ol className="mt-3 space-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-muted hover:text-text">{i + 1}. {s.title}</a></li>
            ))}
          </ol>
        </nav>
        <div className="prose-article max-w-prose text-[15px] text-text/90 [&_h2]:mt-0">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-border pb-8 last:border-0">
              <h2>{i + 1}. {s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
