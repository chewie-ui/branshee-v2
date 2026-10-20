import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { sanitizeArticleHtml } from "@/server/rich-text";
import { countArticleView, getArticle, relatedArticles, siteUrl } from "@/server/site";

type Params = Promise<{ slug: string }>;
const fmt = (d: Date) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(d);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return {};
  return {
    title: a.metaTitle || a.title,
    description: a.metaDescription || a.excerpt || undefined,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: { type: "article", title: a.metaTitle || a.title, description: a.metaDescription || a.excerpt || undefined, images: a.coverImageUrl ? [a.coverImageUrl] : undefined, publishedTime: (a.publishedAt ?? a.createdAt).toISOString() },
  };
}

/** Coupe l'article après le 3e paragraphe pour y glisser l'encart d'inscription (articles assez longs seulement). */
function splitForCta(html: string) {
  const parts = html.split(/(?<=<\/p>)/);
  if (parts.length < 7) return [html, ""] as const;
  return [parts.slice(0, 3).join(""), parts.slice(3).join("")] as const;
}

export default async function ArticlePage({ params }: { params: Params }) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();
  after(() => countArticleView(a.id));
  const related = await relatedArticles(a.id, a.category);
  const [first, rest] = splitForCta(sanitizeArticleHtml(a.contentHtml));
  const published = a.publishedAt ?? a.scheduledFor ?? a.createdAt;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.metaDescription || a.excerpt || undefined,
    image: a.coverImageUrl ? new URL(a.coverImageUrl, siteUrl()).toString() : undefined,
    datePublished: published.toISOString(),
    dateModified: a.updatedAt.toISOString(),
    author: { "@type": "Organization", name: a.authorName },
    publisher: { "@type": "Organization", name: "Branshee" },
    mainEntityOfPage: `${siteUrl()}/blog/${a.slug}`,
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Le blog</Link>
      {a.category ? <p className="mt-6 text-sm font-semibold text-accent">{a.category}</p> : null}
      <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{a.title}</h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{a.authorName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={published.toISOString()}>{fmt(published)}</time>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{a.readingMinutes} min de lecture</span>
      </p>
      {a.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverImageUrl} alt="" className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover" />
      ) : null}
      {a.excerpt ? <p className="mt-8 text-lg leading-relaxed text-muted">{a.excerpt}</p> : null}
      <div className="prose-article mt-8 text-[17px]" dangerouslySetInnerHTML={{ __html: first }} />
      {rest ? (
        <>
          <aside className="my-10 rounded-2xl border border-accent/30 bg-accent-soft p-6">
            <p className="font-semibold text-accent-soft-foreground">Vos clients réservent seuls, 24 h/24</p>
            <p className="mt-1 text-sm text-text/80">Agenda en ligne, rappels automatiques, 0 % de commission. Gratuit pour commencer, en ligne en 10 minutes.</p>
            <Link href="/inscription" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Essayer gratuitement<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </aside>
          <div className="prose-article text-[17px]" dangerouslySetInnerHTML={{ __html: rest }} />
        </>
      ) : null}
      {a.tags.length ? (
        <ul className="mt-10 flex flex-wrap gap-2">
          {a.tags.map((t) => <li key={t} className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">{t}</li>)}
        </ul>
      ) : null}
      {!rest ? (
        <div className="mt-12 rounded-2xl border border-accent/30 bg-accent-soft p-6">
          <p className="font-semibold text-accent-soft-foreground">Vos clients réservent seuls, 24 h/24</p>
          <p className="mt-1 text-sm text-text/80">Gratuit pour commencer, en ligne en 10 minutes, sans commission.</p>
          <Link href="/inscription" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Créer mon agenda<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
      ) : null}
      {related.length ? (
        <aside className="mt-14 border-t border-border pt-8">
          <p className="text-lg font-semibold">À lire aussi</p>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/blog/${r.slug}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-border-strong">
                  <span className="block font-medium leading-snug">{r.title}</span>
                  <span className="mt-2 block text-xs text-muted">{r.readingMinutes} min de lecture</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </article>
  );
}
