import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireSuperadmin } from "@/server/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin Branshee" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireSuperadmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Brand />
            <span className="rounded-md bg-text px-1.5 py-0.5 text-xs font-semibold text-surface">Admin</span>
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:inline">{admin.email}</span>
            <Link href="/app" className="inline-flex items-center gap-1 font-medium text-muted hover:text-text">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Mon espace
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
