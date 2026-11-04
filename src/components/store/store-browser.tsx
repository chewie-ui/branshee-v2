"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AppTile, CustomTile } from "@/components/store/store-parts";
import { CATEGORY_LABEL, type AppCategory, type SkyApp } from "@/lib/apps";
import { fold, type StoreApp } from "@/lib/app-store";

type Item = { app: SkyApp; store: StoreApp; metiers: string[] };

/** Catalogue : recherche (nom, accroche, métiers concernés) puis apps rangées par catégorie. */
export function StoreBrowser({ items, order }: { items: Item[]; order: AppCategory[] }) {
  const [q, setQ] = useState("");
  const query = fold(q.trim());
  const results = useMemo(() => {
    if (!query) return [];
    const words = query.split(/\s+/);
    return items.filter(({ app, store, metiers }) => {
      const hay = fold([app.name, app.tagline, store.titre, ...store.tags, ...metiers].join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [items, query]);

  return (
    <>
      <div className="relative mt-8 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="store-q" className="sr-only">Rechercher une app ou un métier</label>
        <input id="store-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : garagiste, caisse, facture, restaurant…" autoComplete="off" className="h-12 w-full rounded-xl border border-border-strong bg-surface pr-11 pl-10 text-base focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
        {q ? <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Effacer la recherche"><X className="size-4" aria-hidden="true" /></button> : null}
      </div>

      {query ? (
        <section className="mt-10" aria-live="polite" aria-labelledby="resultats">
          <h2 id="resultats" className="text-xl font-semibold tracking-tight">{results.length ? `${results.length} app${results.length > 1 ? "s" : ""} pour « ${q.trim()} »` : `Aucune app pour « ${q.trim()} »`}</h2>
          {!results.length ? <p className="mt-1 text-muted">Pas de souci : décrivez ce qu&apos;il vous faut, on peut la construire pour vous.</p> : null}
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ app, store }) => <li key={app.id}><AppTile app={app} store={store} /></li>)}
            <li><CustomTile /></li>
          </ul>
        </section>
      ) : (
        order.map((cat, i) => {
          const list = items.filter(({ app }) => app.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="mt-12" aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="text-xl font-semibold tracking-tight">{CATEGORY_LABEL[cat]}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(({ app, store }) => <li key={app.id}><AppTile app={app} store={store} /></li>)}
                {i === order.length - 1 ? <li><CustomTile /></li> : null}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
