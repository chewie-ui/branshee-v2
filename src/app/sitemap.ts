import type { MetadataRoute } from "next";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { allSeoPages } from "@/lib/seo-landing";
import { knownMetiers, metierFromSlug } from "@/lib/directory";
import { slugify } from "@/lib/slug";
import { declaredTypesAndCities, listArticles, siteUrl } from "@/server/site";
import { CUSTOM_SERVICES, SERVICE_CITIES } from "@/lib/custom-services";
import { currentBrand } from "@/server/brand";

export const dynamic = "force-dynamic";

/** Plan du site : pages publiques, pages SEO, articles et pages de réservation (hors pause / suppression). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [biz, blog, declared] = await Promise.all([
    db.select({ slug: businesses.slug, updatedAt: businesses.updatedAt }).from(businesses).innerJoin(users, eq(users.id, businesses.ownerId)).where(and(isNull(businesses.deletedAt), isNull(businesses.pausedAt), isNull(users.disabledAt), eq(businesses.isDemo, false), sql`true`)),
    listArticles({ per: 1000 }),
    declaredTypesAndCities(),
  ]);
  // Annuaire : pages « métier » et seulement les « métier à ville » où au moins un pro figure (pas de page vide).
  const metiers = new Set<string>();
  const combos = new Set<string>();
  for (const r of declared.rows) {
    const type = (r.type ?? "").toLowerCase();
    if (!type.trim()) continue;
    const m = knownMetiers().find((x) => x.keywords.some((k) => type.includes(k.toLowerCase())))?.slug ?? slugify(type);
    if (!metierFromSlug(m, [type])) continue; // métier qui est en fait une ville
    metiers.add(m);
    const v = slugify(r.city ?? "");
    if (v.length > 2) combos.add(`${m}/${v}`);
  }
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
  // Skydev : pages sur mesure (services et création de site par ville).
  const custom: MetadataRoute.Sitemap =
    (await currentBrand()).id === "skydev"
      ? [
          { url: `${base}/sur-mesure`, changeFrequency: "monthly", priority: 0.9 },
          ...CUSTOM_SERVICES.map((s) => ({ url: `${base}/sur-mesure/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
          ...SERVICE_CITIES.map((c) => ({ url: `${base}/sur-mesure/creation-site-internet/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
        ]
      : [];
  return [
    ...fixed,
    ...custom,
    ...[...metiers].map((m) => ({ url: `${base}/annuaire/${m}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...[...combos].map((c) => ({ url: `${base}/annuaire/${c}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...allSeoPages().map((p) => ({ url: `${base}/logiciel-rendez-vous/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...blog.rows.map((a) => ({ url: `${base}/blog/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...biz.map((b) => ({ url: `${base}/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
