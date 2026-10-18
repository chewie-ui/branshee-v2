import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { articleCategories, listArticles } from "@/server/site";

export const metadata: Metadata = {
  title: "Blog — conseils pour les indépendants",
  description: "Remplir son agenda, réduire les rendez-vous manqués, se faire connaître en ligne : des conseils concrets pour les professionnels sur rendez-vous.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(d);

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ categorie?: string; page?: string }> }) {
  const sp = await searchParams;
  const category = sp.categorie?.slice(0, 60) || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const [res, cats] = await Promise.all([listArticles({ category, page }), articleCategories()]);
  const href = (p: { categorie?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (p.categorie) q.set("categorie", p.categorie);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return q.toString() ? `/blog?${q}` : "/blog";
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Le blog</h1>
      <p className="mt-2 max-w-2xl text-muted">Des conseils concrets pour remplir votre agenda, réduire les absences et vous faire connaître.</p>
      {cats.length ? (
        <nav aria-label="Catégories" className="mt-6 flex flex-wrap gap-2">
          <Link href="/blog" className={cn("rounded-full border px-3 py-1.5 text-sm", !category ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>Tous</Link>
          {cats.map((c) => (
            <Link key={c.name} href={href({ categorie: c.name })} className={cn("rounded-full border px-3 py-1.5 text-sm", category === c.name ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>{c.name}</Link>
          ))}
        </nav>
      ) : null}
      {res.rows.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center text-muted">Aucun article pour le moment. Revenez bientôt !</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {res.rows.map((a) => (
            <li key={a.id}>
              <Link href={`/blog/${a.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong">
                {a.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex aspect-[16/9] w-full items-center justify-center bg-accent-soft text-2xl font-semibold text-accent-soft-foreground" aria-hidden="true">{a.title.slice(0, 1)}</span>
                )}
                <span className="flex flex-1 flex-col p-5">
                  {a.category ? <span className="text-xs font-semibold text-accent">{a.category}</span> : null}
                  <span className="mt-1 text-lg font-semibold leading-snug group-hover:underline">{a.title}</span>
                  {a.excerpt ? <span className="mt-2 line-clamp-3 text-sm text-muted">{a.excerpt}</span> : null}
                  <span className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted">
                    <span>{fmt(new Date(a.publishedAt))}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{a.readingMinutes} min</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {res.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={href({ categorie: category, page: page - 1 })} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Articles plus récents</Link> : null}
          <span className="text-muted">Page {page} sur {res.pages}</span>
          {page < res.pages ? <Link href={href({ categorie: category, page: page + 1 })} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Articles plus anciens</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
