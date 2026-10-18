import type { MetadataRoute } from "next";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { allSeoPages } from "@/lib/seo-landing";
import { listArticles, siteUrl } from "@/server/site";

export const dynamic = "force-dynamic";

/** Plan du site : pages publiques, pages SEO, articles et pages de réservation (hors pause / suppression). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [biz, blog] = await Promise.all([
    db.select({ slug: businesses.slug, updatedAt: businesses.updatedAt }).from(businesses).innerJoin(users, eq(users.id, businesses.ownerId)).where(and(isNull(businesses.deletedAt), isNull(businesses.pausedAt), isNull(users.disabledAt), sql`true`)),
    listArticles({ per: 1000 }),
  ]);
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tarifs`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/annuaire`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/logiciel-rendez-vous`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/conditions-utilisation`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...fixed,
    ...allSeoPages().map((p) => ({ url: `${base}/logiciel-rendez-vous/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...blog.rows.map((a) => ({ url: `${base}/blog/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...biz.map((b) => ({ url: `${base}/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
