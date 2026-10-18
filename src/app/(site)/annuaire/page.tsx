import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search, Star } from "lucide-react";
import { FeatureStatusPage } from "@/components/feature-status";
import { cn } from "@/lib/cn";
import { featureStatus } from "@/server/features";
import { directoryCategories, searchDirectory } from "@/server/site";

export const metadata: Metadata = {
  title: "Trouver un professionnel et réserver en ligne",
  description: "Kinés, ostéopathes, coiffeurs, coachs, esthéticiennes… Trouvez un professionnel près de chez vous et réservez en ligne, 24 h/24.",
  alternates: { canonical: "/annuaire" },
};

type SP = Promise<{ q?: string; ou?: string; metier?: string; note?: string; page?: string }>;

export default async function DirectoryPage({ searchParams }: { searchParams: SP }) {
  const gate = await featureStatus("search");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const ou = sp.ou?.trim().slice(0, 80) ?? "";
  const metier = sp.metier?.trim().slice(0, 80) ?? "";
  const note = sp.note === "4" || sp.note === "4.5" ? Number(sp.note) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const [res, cats] = await Promise.all([searchDirectory({ name: q, location: ou, category: metier, minRating: note, page }), directoryCategories()]);
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { q, ou, metier, note: note ? String(note) : "" };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/annuaire?${s}` : "/annuaire";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trouver un professionnel</h1>
      <p className="mt-2 text-muted">Réservez en ligne, 24 h/24, sans appeler.</p>

      <form className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]" role="search" action="/annuaire">
        <label className="relative">
          <span className="sr-only">Métier ou nom</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="Kiné, coiffeur, nom du cabinet…" className="h-11 w-full rounded-lg border border-border-strong bg-surface pr-3 pl-9 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
        </label>
        <label className="relative">
          <span className="sr-only">Ville ou code postal</span>
          <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input name="ou" defaultValue={ou} placeholder="Ville ou code postal" className="h-11 w-full rounded-lg border border-border-strong bg-surface pr-3 pl-9 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
        </label>
        {metier ? <input type="hidden" name="metier" value={metier} /> : null}
        <button type="submit" className="h-11 rounded-lg bg-accent px-6 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Rechercher</button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={qs({ metier: null, page: null })} className={cn("rounded-full border px-3 py-1.5 text-sm", !metier ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>Tous</Link>
        {cats.map((c) => (
          <Link key={c.name} href={qs({ metier: c.name, page: null })} className={cn("rounded-full border px-3 py-1.5 text-sm", metier.toLowerCase() === c.name.toLowerCase() ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>
            {c.name} <span className="tabular-nums opacity-70">{c.n}</span>
          </Link>
        ))}
        <Link href={qs({ note: note ? null : "4.5", page: null })} className={cn("ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm", note ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")} aria-pressed={!!note}>
          <Star className="size-3.5" aria-hidden="true" /> 4,5 et plus
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted" role="status">{res.total} établissement{res.total > 1 ? "s" : ""}</p>
      {res.rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-medium">Aucun professionnel ne correspond à cette recherche.</p>
          <p className="mt-1 text-sm text-muted">Essayez une autre ville ou un autre métier. Vous êtes professionnel ? <Link href="/inscription" className="font-medium text-accent hover:text-accent-hover">Créez votre page gratuitement</Link>.</p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.rows.map((b) => (
            <li key={b.id}>
              <Link href={`/${b.slug}`} className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
                <span className="flex items-center gap-3">
                  {b.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.photoUrl} alt="" className="size-12 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground" aria-hidden="true">{b.name.slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{b.name}</span>
                    <span className="block truncate text-sm text-muted">{b.type ?? "Professionnel"}</span>
                  </span>
                </span>
                <span className="mt-4 flex items-center justify-between text-sm text-muted">
                  <span className="inline-flex items-center gap-1 truncate"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{b.city ?? "—"}</span>
                  {b.rating ? <span className="inline-flex items-center gap-1 text-text"><Star className="size-3.5 fill-current text-warning" aria-hidden="true" />{String(b.rating).replace(".", ",")} <span className="text-muted">({b.reviews})</span></span> : null}
                </span>
                <span className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-border-strong text-sm font-medium">Prendre rendez-vous</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {res.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Précédent</Link> : null}
          <span className="text-muted">Page {page} sur {res.pages}</span>
          {page < res.pages ? <Link href={qs({ page: String(page + 1) })} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Suivant</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
