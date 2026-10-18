import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ArticleEditor } from "@/components/admin/article-editor";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Nouvel article" };

export default async function NewArticle() {
  await requireSuperadmin();
  return (
    <>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Blog
      </Link>
      <ArticleEditor initial={{ id: null, title: "", slug: "", excerpt: "", coverImageUrl: "", contentHtml: "", category: "", tags: "", status: "draft", scheduledFor: "", metaTitle: "", metaDescription: "", authorName: "L’équipe Branshee" }} />
    </>
  );
}
