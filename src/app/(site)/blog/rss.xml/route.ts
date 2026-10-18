import { listArticles, siteUrl } from "@/server/site";

export const dynamic = "force-dynamic";

const esc = (s: string | null | undefined) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Flux RSS des 50 derniers articles publiés. */
export async function GET() {
  const base = siteUrl();
  const { rows } = await listArticles({ per: 50 });
  const items = rows
    .map((a) => `
  <item>
    <title>${esc(a.title)}</title>
    <link>${base}/blog/${a.slug}</link>
    <guid isPermaLink="true">${base}/blog/${a.slug}</guid>
    <description>${esc(a.excerpt)}</description>${a.category ? `\n    <category>${esc(a.category)}</category>` : ""}
    <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
  </item>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Blog Branshee</title>
  <link>${base}/blog</link>
  <atom:link href="${base}/blog/rss.xml" rel="self" type="application/rss+xml" />
  <description>Conseils pratiques pour les indépendants : remplir son agenda, réduire les rendez-vous manqués, se faire connaître en ligne.</description>
  <language>fr-BE</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
