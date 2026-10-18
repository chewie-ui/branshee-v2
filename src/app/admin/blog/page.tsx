import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay, formatTime } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Blog" };
const TZ = "Europe/Brussels";

export default async function AdminBlog() {
  await requireSuperadmin();
  const rows = await db
    .select({ id: articles.id, title: articles.title, slug: articles.slug, status: articles.status, publishedAt: articles.publishedAt, scheduledFor: articles.scheduledFor, views: articles.views, category: articles.category, updatedAt: articles.updatedAt })
    .from(articles)
    .orderBy(desc(articles.updatedAt));
  return (
    <>
      <PageHeader title="Blog" description="Articles publics (référencement). Le centre d'aide des pros se gère à part." action={<ButtonLink href="/admin/blog/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>Nouvel article</ButtonLink>} />
      <Card>
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/blog/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-muted">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="block truncate font-medium">{a.title}</span>
                  <span className="block truncate text-sm text-muted">/blog/{a.slug}{a.category ? ` · ${a.category}` : ""}</span>
                </span>
                {a.status === "published" ? (
                  <Badge tone="success">Publié{a.publishedAt ? ` le ${formatDay(a.publishedAt, TZ, "d MMM yyyy")}` : ""}</Badge>
                ) : a.status === "scheduled" ? (
                  <Badge tone="accent">Programmé{a.scheduledFor ? ` : ${formatDay(a.scheduledFor, TZ, "d MMM")} ${formatTime(a.scheduledFor, TZ)}` : ""}</Badge>
                ) : (
                  <Badge>Brouillon</Badge>
                )}
                <span className="w-24 text-right text-sm text-muted tabular-nums">{a.views} vue{a.views > 1 ? "s" : ""}</span>
              </Link>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun article.</li> : null}
        </ul>
      </Card>
    </>
  );
}
