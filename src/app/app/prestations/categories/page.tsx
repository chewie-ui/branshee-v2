import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, serviceCategories, services } from "@/db/schema";
import { CategoriesEditor } from "@/components/services/categories-editor";
import { ServiceTabs } from "@/components/services/service-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const ctx = await requireContext("services.manage");
  const [cats, [page]] = await Promise.all([
    db
      .select({ id: serviceCategories.id, name: serviceCategories.name, icon: serviceCategories.icon, count: sql<number>`(select count(*)::int from ${services} where ${services.categoryId} = "service_categories"."id")` })
      .from(serviceCategories)
      .where(eq(serviceCategories.businessId, ctx.business.id))
      .orderBy(asc(serviceCategories.position), asc(serviceCategories.name)),
    db.select({ style: bookingPageSettings.categoryStyle }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id)),
  ]);
  return (
    <>
      <PageHeader title="Prestations" />
      <ServiceTabs />
      <div className="mx-auto max-w-3xl">
        <CategoriesEditor categories={cats} style={page?.style ?? "pills"} />
      </div>
    </>
  );
}
