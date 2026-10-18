"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { requireSuperadmin } from "@/server/admin";
import { richTextToPlain, sanitizeArticleHtml } from "@/server/rich-text";
import { savePublicImage } from "@/server/storage";

type Result = { ok: boolean; error?: string; message?: string; id?: string };

const schema = z.object({
  title: z.string().trim().min(3, "Titre trop court.").max(160),
  slug: z.string().trim().max(120),
  excerpt: z.string().trim().max(400),
  coverImageUrl: z.string().trim().max(500).refine((v) => !v || v.startsWith("/media/") || v.startsWith("https://"), "Image de couverture invalide."),
  contentHtml: z.string().max(400000),
  category: z.string().trim().max(60),
  tags: z.string().max(400),
  status: z.enum(["draft", "scheduled", "published"]),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")),
  metaTitle: z.string().trim().max(70),
  metaDescription: z.string().trim().max(170),
  authorName: z.string().trim().max(80),
});

function brussels(v: string) {
  const [d, t] = v.split("T") as [string, string];
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const [h, min] = t.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, day, h, min, 0, "Europe/Brussels").getTime());
}

/** Enregistre un article (création si `id` est null). Le HTML est nettoyé ; le temps de lecture est calculé. */
export async function saveArticle(id: string | null, input: z.input<typeof schema>): Promise<Result> {
  await requireSuperadmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Article invalide." };
  const d = parsed.data;
  const slug = slugify(d.slug || d.title).slice(0, 100);
  if (!slug) return { ok: false, error: "Adresse de l'article invalide." };
  const [dup] = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.slug, slug), id ? ne(articles.id, id) : undefined));
  if (dup) return { ok: false, error: "Un autre article utilise déjà cette adresse." };
  const html = sanitizeArticleHtml(d.contentHtml);
  const words = richTextToPlain(html).split(/\s+/).filter(Boolean).length;
  const scheduledFor = d.status === "scheduled" ? (d.scheduledFor ? brussels(d.scheduledFor) : null) : null;
  if (d.status === "scheduled" && (!scheduledFor || scheduledFor < new Date())) return { ok: false, error: "Choisissez une date de publication dans le futur." };
  const [cur] = id ? await db.select({ publishedAt: articles.publishedAt, status: articles.status }).from(articles).where(eq(articles.id, id)) : [];
  if (id && !cur) return { ok: false, error: "Article introuvable." };
  const values = {
    title: d.title,
    slug,
    excerpt: d.excerpt || null,
    coverImageUrl: d.coverImageUrl || null,
    contentHtml: html,
    category: d.category || null,
    tags: [...new Set(d.tags.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 12),
    status: d.status,
    scheduledFor,
    publishedAt: d.status === "published" ? (cur?.publishedAt ?? new Date()) : (cur?.publishedAt ?? null),
    metaTitle: d.metaTitle || null,
    metaDescription: d.metaDescription || null,
    authorName: d.authorName || "L’équipe Branshee",
    readingMinutes: Math.max(1, Math.round(words / 220)),
  };
  let saved = id;
  if (id) await db.update(articles).set(values).where(eq(articles.id, id));
  else saved = (await db.insert(articles).values(values).returning({ id: articles.id }))[0]!.id;
  revalidatePath("/admin/blog");
  revalidatePath("/blog", "layout");
  return { ok: true, id: saved!, message: d.status === "published" ? "Article publié." : d.status === "scheduled" ? "Publication programmée." : "Brouillon enregistré." };
}

export async function deleteArticle(id: string) {
  await requireSuperadmin();
  await db.delete(articles).where(eq(articles.id, z.uuid().parse(id)));
  revalidatePath("/admin/blog");
  revalidatePath("/blog", "layout");
  redirect("/admin/blog");
}

export async function duplicateArticle(id: string) {
  await requireSuperadmin();
  const [a] = await db.select().from(articles).where(eq(articles.id, z.uuid().parse(id)));
  if (!a) return;
  const base = `${a.slug}-copie`;
  let slug = base;
  for (let i = 2; (await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug))).length; i++) slug = `${base}-${i}`;
  const [row] = await db
    .insert(articles)
    .values({ title: `${a.title} (copie)`, slug, excerpt: a.excerpt, coverImageUrl: a.coverImageUrl, contentHtml: a.contentHtml, category: a.category, tags: a.tags, status: "draft", metaTitle: a.metaTitle, metaDescription: a.metaDescription, authorName: a.authorName, readingMinutes: a.readingMinutes })
    .returning({ id: articles.id });
  revalidatePath("/admin/blog");
  redirect(`/admin/blog/${row!.id}`);
}

/** Image d'article (couverture ou dans le texte) : 5 Mo max, JPG / PNG / WebP / GIF. */
export async function uploadArticleImage(fd: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireSuperadmin();
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { ok: false, error: "Aucun fichier." };
  if (f.size > 5 * 1024 * 1024) return { ok: false, error: "Image trop lourde (5 Mo maximum)." };
  try {
    return { ok: true, url: await savePublicImage(Buffer.from(await f.arrayBuffer())) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Image refusée." };
  }
}
