import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { ArticleEditor } from "@/components/admin/article-editor";
import { zoned } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Article" };

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [a] = await db.select().from(articles).where(eq(articles.id, id.data));
  if (!a) notFound();
  return (
    <>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Blog
      </Link>
      <ArticleEditor
        key={a.id}
        initial={{
          id: a.id,
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt ?? "",
          coverImageUrl: a.coverImageUrl ?? "",
          contentHtml: a.contentHtml,
          category: a.category ?? "",
          tags: a.tags.join(", "),
          status: a.status,
          scheduledFor: a.scheduledFor ? format(zoned(a.scheduledFor, "Europe/Brussels"), "yyyy-MM-dd'T'HH:mm") : "",
          metaTitle: a.metaTitle ?? "",
          metaDescription: a.metaDescription ?? "",
          authorName: a.authorName,
        }}
      />
    </>
  );
}
