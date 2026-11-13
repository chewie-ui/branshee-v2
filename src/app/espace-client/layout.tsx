import type { Metadata } from "next";
import type { ReactNode } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, members } from "@/db/schema";
import { currentBrand } from "@/server/brand";
import { ClientNav } from "@/components/client/client-nav";
import { ClientTopBar } from "@/components/client/client-top-bar";
import { requireClient } from "@/server/client-account";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = (await currentBrand()).name;
  return { title: { default: `Mon espace · ${name}`, template: `%s · ${name}` } };
}

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const user = await requireClient();
  const brand = (await currentBrand()).id;
  // Ses entreprises (s'il en a) : le même menu que côté pro pour passer de l'espace client à une entreprise.
  const mine = await db
    .select({ id: businesses.id, name: businesses.name, businessType: businesses.businessType })
    .from(members)
    .innerJoin(businesses, eq(businesses.id, members.businessId))
    .where(and(eq(members.userId, user.id), eq(members.status, "active"), eq(members.isActive, true), isNull(businesses.deletedAt)))
    .orderBy(asc(businesses.createdAt));
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <ClientTopBar brand={brand} businesses={mine} user={{ name: user.fullName, email: user.email, avatarUrl: user.avatarUrl }} />
        <ClientNav />
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
