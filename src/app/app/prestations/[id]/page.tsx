import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceMembers, services } from "@/db/schema";
import { ServiceForm } from "@/components/services/service-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { serviceFormData } from "@/server/services-page";

export const metadata: Metadata = { title: "Modifier la prestation" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("services.manage");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [service] = await db.select().from(services).where(and(eq(services.id, id.data), eq(services.businessId, ctx.business.id)));
  if (!service) notFound();
  const [data, links] = await Promise.all([serviceFormData(ctx.business.id), db.select({ memberId: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, service.id))]);
  const memberIds = links.map((l) => l.memberId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/prestations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Prestations
      </Link>
      <PageHeader title={service.name} />
      <ServiceForm
        {...data}
        initial={{
          id: service.id,
          name: service.name,
          description: service.description ?? "",
          categoryId: service.categoryId ?? "",
          durationMin: service.durationMin,
          price: service.priceCents == null ? "" : (service.priceCents / 100).toString().replace(".", ","),
          color: service.color ?? "#4f46e5",
          audience: service.audience,
          isActive: service.isActive,
          memberIds: memberIds.length === data.team.length ? [] : memberIds,
        }}
      />
    </div>
  );
}
