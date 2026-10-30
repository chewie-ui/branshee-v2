import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { FeatureStatusPage } from "@/components/feature-status";
import { DirectoryGrid } from "@/components/directory/directory-card";
import { DirectoryLinks, ProCallout } from "@/components/directory/directory-links";
import { DirectorySearch } from "@/components/directory/directory-search";
import { cn } from "@/lib/cn";
import { matchMetier, metierFromSlug, metierUrl, metierVilleUrl, splitQuery } from "@/lib/directory";
import { slugify } from "@/lib/slug";
import { currentBrand } from "@/server/brand";
import { directoryVocabulary } from "@/server/directory";
import { featureStatus } from "@/server/features";
import { directoryCategories, searchDirectory } from "@/server/site";

export const metadata: Metadata = {
  title: "Trouver un professionnel près de chez vous et réserver en ligne",
  description: "Coiffeurs, kinés, ostéopathes, esthéticiennes, coachs… Trouvez un professionnel indépendant près de chez vous en Belgique et réservez en ligne, 24 h/24.",
  alternates: { canonical: "/annuaire" },
};

type SP = Promise<{ q?: string; ou?: string; metier?: string; note?: string; page?: string }>;

export default async function DirectoryPage({ searchParams }: { searchParams: SP }) {
  const gate = await featureStatus("search");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const sp = await searchParams;
  let q = sp.q?.trim().slice(0, 80) ?? "";
  let ou = sp.ou?.trim().slice(0, 80) ?? "";
  const metier = sp.metier?.trim().slice(0, 80) ?? "";
  const note = sp.note === "4" || sp.note === "4.5" ? Number(sp.note) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const vocab = await directoryVocabulary();

  // « coiffeur wavre » dans un seul champ : on sépare le métier de la ville.
  if (q && !ou) {
    const split = splitQuery(q, vocab.villes);
    if (split) [q, ou] = [split.what, split.where];
  }
  // Métier reconnu (et ville connue) sans autre filtre : la page dédiée, celle que Google référence.
  const known = q ? (matchMetier(q) ?? metierFromSlug(slugify(q), vocab.types)) : null;
  if (known && !metier && !note && page === 1) {
    if (!ou) redirect(metierUrl(known.slug));
    const ville = vocab.villes.find((v) => v.slug === slugify(ou));
    if (ville) redirect(metierVilleUrl(known.slug, ville.slug));
  }

  const [res, cats, brand] = await Promise.all([
    searchDirectory({ name: known ? undefined : q, keywords: known?.keywords, location: ou, category: metier, minRating: note, page }),
    directoryCategories(),
    currentBrand(),
  ]);
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { q, ou, metier, note: note ? String(note) : "" };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/annuaire?${s}` : "/annuaire";
  };
  const searching = !!(q || ou || metier || note);
  const chip = (on: boolean) => cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150", on ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:border-border-strong hover:text-text");

  return (
    <div className="tw mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className={cn(!searching && "mx-auto max-w-3xl text-center")}>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{searching ? "Trouver un professionnel" : "Trouvez le bon pro, près de chez vous"}</h1>
        <p className="mt-2 text-muted">Des indépendants belges qui prennent leurs rendez-vous en ligne. Réservez en quelques clics, 24 h/24, sans appeler.</p>
      </div>
      <div className={cn("mt-6", !searching && "mx-auto max-w-4xl")}>
        <DirectorySearch q={q} ou={ou} metiers={vocab.metierNames} villes={vocab.villeNames} big={!searching} />
      </div>

      {cats.length ? (
        <div className={cn("mt-5 flex flex-wrap items-center gap-2", !searching && "justify-center")}>
          <Link href={qs({ metier: null, page: null })} className={chip(!metier)}>Tous</Link>
          {cats.map((c) => (
            <Link key={c.name} href={qs({ metier: c.name, page: null })} className={chip(metier.toLowerCase() === c.name.toLowerCase())}>
              {c.name} <span className="tabular-nums opacity-70">{c.n}</span>
            </Link>
          ))}
          <Link href={qs({ note: note ? null : "4.5", page: null })} className={cn(chip(!!note), searching && "sm:ml-auto")} aria-pressed={!!note}>
            <Star className="size-3.5" aria-hidden="true" /> 4,5 et plus
          </Link>
        </div>
      ) : null}

      <h2 className="mt-10 text-sm font-medium text-muted" role="status">
        {searching ? `${res.total} résultat${res.total > 1 ? "s" : ""}${q ? ` pour « ${q} »` : ""}${ou ? ` à ${ou}` : ""}` : "Professionnels sur l'annuaire"}
      </h2>
      {res.rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-medium">Aucun professionnel ne correspond à cette recherche.</p>
          <p className="mt-1 text-sm text-muted">Essayez une ville voisine, un autre mot (par exemple le nom d&apos;une prestation) ou retirez un filtre.</p>
          {searching ? <Link href="/annuaire" className="mt-4 inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-medium transition-colors duration-150 hover:bg-surface-muted">Voir tous les professionnels</Link> : null}
        </div>
      ) : (
        <div className="mt-4">
          <DirectoryGrid rows={res.rows} />
        </div>
      )}
      {res.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Précédent</Link> : null}
          <span className="text-muted">Page {page} sur {res.pages}</span>
          {page < res.pages ? <Link href={qs({ page: String(page + 1) })} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Suivant</Link> : null}
        </nav>
      ) : null}

      <ProCallout brandName={brand.name} />
      <DirectoryLinks villes={vocab.villes.slice(0, 30)} />
    </div>
  );
}
