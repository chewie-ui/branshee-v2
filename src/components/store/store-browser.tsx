"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AppTile, CustomTile } from "@/components/store/store-parts";
import { CATEGORY_LABEL, type AppCategory, type SkyApp } from "@/lib/apps";
import { CATEGORY_LABEL_EN } from "@/lib/apps-i18n";
import type { SiteLocale } from "@/lib/site-locale";
import { fold, searchApps, type StoreApp } from "@/lib/app-store";

type Item = { app: SkyApp; store: StoreApp; metiers: string[] };

/** Catalogue : recherche (nom, accroche, métiers concernés) puis apps rangées par catégorie. */
const T = {
  fr: { label: "Rechercher une app ou un métier", ph: "Rechercher : garagiste, caisse, facture, restaurant…", clear: "Effacer la recherche", none: (q: string) => `Aucune app pour « ${q} »`, count: (n: number, q: string) => `${n} app${n > 1 ? "s" : ""} pour « ${q} »`, noneHint: "Pas de souci : décrivez ce qu'il vous faut, on peut la construire pour vous." },
  en: { label: "Search for an app or a trade", ph: "Search: mechanic, invoices, point of sale, restaurant…", clear: "Clear search", none: (q: string) => `No app for “${q}”`, count: (n: number, q: string) => `${n} app${n > 1 ? "s" : ""} for “${q}”`, noneHint: "No problem: describe what you need and we can build it for you." },
};

export function StoreBrowser({ items, order, locale = "fr" }: { items: Item[]; order: AppCategory[]; locale?: SiteLocale }) {
  const t = T[locale];
  const labels = locale === "en" ? CATEGORY_LABEL_EN : CATEGORY_LABEL;
  const [q, setQ] = useState("");
  const query = fold(q.trim());
  const results = useMemo(() => {
    if (!query) return [];
    const flat = items.map((x) => ({ id: x.app.id, name: x.app.name, tagline: x.app.tagline, tags: x.store.tags, extra: [x.store.titre, ...x.metiers].join(" "), x }));
    return searchApps(flat, query).map((f) => f.x);
  }, [items, query]);

  return (
    <>
      <div className="relative mt-8 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="store-q" className="sr-only">{t.label}</label>
        <input id="store-q" type="text" inputMode="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.ph} autoComplete="off" className="h-12 w-full rounded-xl border border-border-strong bg-surface pr-11 pl-10 text-base focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
        {q ? <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={t.clear}><X className="size-4" aria-hidden="true" /></button> : null}
      </div>

      {query ? (
        <section className="mt-10" aria-live="polite" aria-labelledby="resultats">
          <h2 id="resultats" className="text-xl font-semibold tracking-tight">{results.length ? t.count(results.length, q.trim()) : t.none(q.trim())}</h2>
          {!results.length ? <p className="mt-1 text-muted">{t.noneHint}</p> : null}
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ app, store }) => <li key={app.id}><AppTile app={app} store={store} locale={locale} /></li>)}
            <li><CustomTile locale={locale} /></li>
          </ul>
        </section>
      ) : (
        order.map((cat, i) => {
          const list = items.filter(({ app }) => app.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="mt-12" aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="text-xl font-semibold tracking-tight">{labels[cat]}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(({ app, store }) => <li key={app.id}><AppTile app={app} store={store} locale={locale} /></li>)}
                {i === order.length - 1 ? <li><CustomTile locale={locale} /></li> : null}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
