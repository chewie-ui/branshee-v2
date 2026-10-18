import "server-only";
import { and, asc, desc, eq, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, businessPlans, businesses, jobTitles, users } from "@/db/schema";
import { PROFESSIONS, professionKey } from "@/lib/professions";

export const siteUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/** Métiers proposés à l'inscription : liste officielle + métiers validés par l'équipe. */
export async function professionList() {
  const approved = await db.select({ name: jobTitles.name }).from(jobTitles).where(eq(jobTitles.status, "approved"));
  const seen = new Set(PROFESSIONS.map(professionKey));
  const extra = approved.map((a) => a.name).filter((n) => !seen.has(professionKey(n)));
  return [...PROFESSIONS, ...extra].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Établissements visibles publiquement : ni supprimés, ni en pause, propriétaire actif. */
const visible = and(isNull(businesses.deletedAt), isNull(businesses.pausedAt), isNull(users.disabledAt));
const like = (s: string) => `%${s.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[\s'-]+/g, "%")}%`;

export type DirectoryEntry = { id: string; name: string; slug: string; type: string | null; city: string | null; photoUrl: string | null; rating: number | null; reviews: number };

const entryCols = {
  id: businesses.id,
  name: businesses.name,
  slug: businesses.slug,
  type: businesses.businessType,
  city: businesses.city,
  photoUrl: businesses.photoUrl,
  rating: sql<number | null>`(select round(avg(r.rating)::numeric, 1)::float from reviews r where r.business_id = ${businesses.id})`,
  reviews: sql<number>`(select count(*)::int from reviews r where r.business_id = ${businesses.id})`,
};

/**
 * Annuaire : recherche par nom / métier, ville ou code postal, métier exact, note minimale.
 * Ordre : mis en avant (position), puis forfait payant, puis note et nombre d'avis.
 */
export async function searchDirectory(q: { name?: string; location?: string; category?: string; minRating?: number | null; page?: number }) {
  const conds = [visible];
  if (q.name) conds.push(or(ilike(businesses.name, like(q.name)), ilike(businesses.businessType, like(q.name)))!);
  if (q.location) conds.push(or(ilike(businesses.city, like(q.location)), ilike(businesses.postalCode, `${q.location.trim()}%`), ilike(businesses.address, like(q.location)))!);
  if (q.category) conds.push(sql`lower(trim(${businesses.businessType})) = ${q.category.trim().toLowerCase()}`);
  if (q.minRating) conds.push(sql`(select avg(r.rating) from reviews r where r.business_id = ${businesses.id}) >= ${q.minRating}`);
  const per = 24;
  const page = Math.max(1, q.page ?? 1);
  const where = and(...conds);
  const [rows, [total]] = await Promise.all([
    db
      .select(entryCols)
      .from(businesses)
      .innerJoin(users, eq(users.id, businesses.ownerId))
      .leftJoin(businessPlans, eq(businessPlans.businessId, businesses.id))
      .where(where)
      .orderBy(
        sql`case when ${businesses.boostPosition} > 0 then ${businesses.boostPosition} else 1000 end`,
        sql`case coalesce(${businessPlans.plan}, 'free') when 'pro_plus' then 0 when 'pro' then 1 else 2 end`,
        sql`(select coalesce(avg(r.rating), 0) from reviews r where r.business_id = ${businesses.id}) desc`,
        sql`(select count(*) from reviews r where r.business_id = ${businesses.id}) desc`,
        asc(businesses.name),
      )
      .limit(per)
      .offset((page - 1) * per),
    db.select({ n: sql<number>`count(*)::int` }).from(businesses).innerJoin(users, eq(users.id, businesses.ownerId)).where(where),
  ]);
  return { rows: rows as DirectoryEntry[], total: total?.n ?? 0, page, pages: Math.max(1, Math.ceil((total?.n ?? 0) / per)) };
}

/** Métiers présents dans l'annuaire, avec leur nombre d'établissements (puces de filtre). */
export async function directoryCategories(limit = 16) {
  return db
    .select({ name: sql<string>`min(trim(${businesses.businessType}))`, n: sql<number>`count(*)::int` })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(visible, sql`coalesce(trim(${businesses.businessType}), '') <> ''`))
    .groupBy(sql`lower(trim(${businesses.businessType}))`)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}

/** Établissements mis en avant (page d'accueil). */
export async function featuredBusinesses(limit = 6) {
  return db
    .select(entryCols)
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(visible, sql`${businesses.boostPosition} > 0`))
    .orderBy(asc(businesses.boostPosition))
    .limit(limit) as Promise<DirectoryEntry[]>;
}

/** Établissements d'une ville (pages SEO), ceux du métier visé d'abord. */
export async function businessesInCity(city: string, keywords: string[], limit = 9) {
  const rows = (await db
    .select(entryCols)
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(visible, or(ilike(businesses.city, like(city)), ilike(businesses.address, like(city)))))
    .limit(40)) as DirectoryEntry[];
  const match = (b: DirectoryEntry) => keywords.some((k) => (b.type ?? "").toLowerCase().includes(k.toLowerCase()));
  return rows.sort((a, b) => Number(match(b)) - Number(match(a))).slice(0, limit);
}

// ─── Blog ────────────────────────────────────────────────────────────────────

/** Publié, ou programmé dont l'heure est passée (même si la tâche planifiée n'est pas encore passée). */
const live = or(eq(articles.status, "published"), and(eq(articles.status, "scheduled"), lte(articles.scheduledFor, sql`now()`)));

export async function listArticles(opts: { category?: string; page?: number; per?: number } = {}) {
  const per = opts.per ?? 12;
  const page = Math.max(1, opts.page ?? 1);
  const where = and(live, opts.category ? eq(articles.category, opts.category) : undefined);
  const [rows, [total]] = await Promise.all([
    db
      .select({ id: articles.id, title: articles.title, slug: articles.slug, excerpt: articles.excerpt, coverImageUrl: articles.coverImageUrl, category: articles.category, publishedAt: sql<Date>`coalesce(${articles.publishedAt}, ${articles.scheduledFor}, ${articles.createdAt})`, readingMinutes: articles.readingMinutes, updatedAt: articles.updatedAt })
      .from(articles)
      .where(where)
      .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.scheduledFor}, ${articles.createdAt})`))
      .limit(per)
      .offset((page - 1) * per),
    db.select({ n: sql<number>`count(*)::int` }).from(articles).where(where),
  ]);
  return { rows, total: total?.n ?? 0, page, pages: Math.max(1, Math.ceil((total?.n ?? 0) / per)) };
}

export async function articleCategories() {
  const rows = await db.select({ c: articles.category, n: sql<number>`count(*)::int` }).from(articles).where(and(live, sql`${articles.category} is not null`)).groupBy(articles.category).orderBy(sql`count(*) desc`);
  return rows.filter((r) => r.c).map((r) => ({ name: r.c!, n: r.n }));
}

export async function getArticle(slug: string) {
  const [a] = await db.select().from(articles).where(and(eq(articles.slug, slug), live));
  return a ?? null;
}

export async function countArticleView(id: string) {
  await db.update(articles).set({ views: sql`${articles.views} + 1` }).where(eq(articles.id, id));
}

export async function relatedArticles(id: string, category: string | null, limit = 3) {
  return db
    .select({ title: articles.title, slug: articles.slug, excerpt: articles.excerpt, coverImageUrl: articles.coverImageUrl, readingMinutes: articles.readingMinutes })
    .from(articles)
    .where(and(live, sql`${articles.id} <> ${id}`))
    .orderBy(sql`(${articles.category} is not distinct from ${category}) desc`, desc(articles.publishedAt))
    .limit(limit);
}
