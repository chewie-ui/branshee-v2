import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Brand } from "@/components/brand";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireSuperadmin } from "@/server/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin Branshee" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireSuperadmin();
  const [b] = await db.execute<{ support: number; reports: number; jobs: number }>(sql`
    select
      (select count(*)::int from support_threads where unread_by_admin > 0) as support,
      (select count(*)::int from review_reports where status = 'pending') as reports,
      (select count(*)::int from job_titles where status = 'pending') as jobs`);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Brand />
            <span className="rounded-md bg-text px-1.5 py-0.5 text-xs font-semibold text-surface">Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:inline">{admin.email}</span>
            <Link href="/app" className="inline-flex items-center gap-1 font-medium text-muted hover:text-text">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Mon espace
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:py-8">
        <aside className="lg:w-52 lg:shrink-0">
          <div className="lg:sticky lg:top-6">
            <AdminNav badges={{ support: Number(b?.support ?? 0), reports: Number(b?.reports ?? 0), jobs: Number(b?.jobs ?? 0) }} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
