import "server-only";
import { and, asc, avg, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, reviews, services, sites } from "@/db/schema";
import { defaultSections } from "@/lib/site-templates";
import { slugify } from "@/lib/slug";
import { businessHas } from "@/server/plan";

/** Site « Mon site » de l'établissement, créé à la première ouverture de l'éditeur. */
export async function getOrCreateSite(businessId: string) {
  const [cur] = await db.select().from(sites).where(eq(sites.businessId, businessId));
  if (cur) return cur;
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) throw new Error("Établissement introuvable.");
  let slug = slugify(b.name).slice(0, 40) || "mon-site";
  for (let i = 2; (await db.select({ id: sites.id }).from(sites).where(eq(sites.slug, slug))).length; i++) slug = `${slugify(b.name).slice(0, 36) || "mon-site"}-${i}`;
  const [row] = await db
    .insert(sites)
    .values({ businessId, slug, sections: defaultSections({ name: b.name, photoUrl: b.photoUrl, phone: b.phone, email: b.email, address: [b.address, b.postalCode, b.city].filter(Boolean).join(", ") || null }) })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.select().from(sites).where(eq(sites.businessId, businessId)))[0]!;
}

/** Contenu nécessaire au rendu du site : prestations actives et avis réels. */
export async function siteContent(businessId: string) {
  const [svc, [stats], list] = await Promise.all([
    db
      .select({ id: services.id, name: services.name, description: services.description, durationMin: services.durationMin, durationMaxMin: services.durationMaxMin, priceCents: services.priceCents, imageUrl: services.imageUrl })
      .from(services)
      .where(and(eq(services.businessId, businessId), eq(services.isActive, true)))
      .orderBy(asc(services.position), asc(services.name)),
    db.select({ n: count(), avg: avg(reviews.rating) }).from(reviews).where(eq(reviews.businessId, businessId)),
    db.select({ id: reviews.id, author: reviews.authorName, rating: reviews.rating, comment: reviews.comment }).from(reviews).where(and(eq(reviews.businessId, businessId), sql`coalesce(${reviews.comment}, '') <> ''`)).orderBy(desc(reviews.rating), desc(reviews.createdAt)).limit(6),
  ]);
  return { services: svc, reviews: { count: stats?.n ?? 0, average: stats?.avg ? Math.round(Number(stats.avg) * 10) / 10 : null, items: list } };
}

/** Site publié à afficher à l'adresse de l'établissement (forfait Pro+ requis), sinon null. */
export async function publishedSiteFor(businessId: string) {
  const [s] = await db.select().from(sites).where(eq(sites.businessId, businessId));
  if (!s?.publishedAt) return null;
  if (!(await businessHas(businessId, "mySite"))) return null;
  return s;
}

export async function countSiteVisit(siteId: string) {
  await db.update(sites).set({ visitCount: sql`${sites.visitCount} + 1` }).where(eq(sites.id, siteId));
}

/** Domaine personnalisé → adresse de l'établissement (site publié uniquement). */
export async function businessSlugForDomain(host: string) {
  const domain = host.toLowerCase().replace(/^www\./, "").split(":")[0]!;
  const [row] = await db
    .select({ slug: businesses.slug })
    .from(sites)
    .innerJoin(businesses, eq(businesses.id, sites.businessId))
    .where(and(sql`${sites.customDomain} in (${domain}, ${"www." + domain})`, sql`${sites.publishedAt} is not null`, sql`${businesses.deletedAt} is null`));
  return row?.slug ?? null;
}
