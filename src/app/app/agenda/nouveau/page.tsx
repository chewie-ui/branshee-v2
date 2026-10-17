import type { Metadata } from "next";
import { format } from "date-fns";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, members, serviceCategories, services } from "@/db/schema";
import { NewAppointmentForm } from "@/components/app/new-appointment-form";
import { PageHeader } from "@/components/ui/page-header";
import { clientWord } from "@/lib/terminology";
import { parseIsoDay, zoned } from "@/lib/time";
import { parseQuickTime } from "@/lib/time-input";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Nouveau rendez-vous" };

type SearchParams = Promise<{ date?: string; heure?: string; membre?: string; client?: string }>;

export default async function NewAppointmentPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("appointments.manage");
  const bid = ctx.business.id;
  const params = await searchParams;

  const [svc, team, clients] = await Promise.all([
    db
      .select({ id: services.id, name: services.name, durationMin: services.durationMin, durationMaxMin: services.durationMaxMin, priceCents: services.priceCents, category: serviceCategories.name })
      .from(services)
      .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
      .where(and(eq(services.businessId, bid), eq(services.isActive, true), eq(services.kind, "individual")))
      .orderBy(asc(services.position)),
    db
      .select({ id: members.id, name: members.displayName })
      .from(members)
      .where(and(eq(members.businessId, bid), eq(members.status, "active"), eq(members.isBookable, true)))
      .orderBy(asc(members.createdAt)),
    db
      .select({ id: customers.id, name: customers.fullName, email: customers.email, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.businessId, bid), isNull(customers.blockedAt)))
      .orderBy(asc(customers.fullName)),
  ]);

  const day = parseIsoDay(params.date) ? params.date! : format(zoned(new Date(), ctx.business.timezone), "yyyy-MM-dd");
  const term = clientWord(ctx.business.businessType);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouveau rendez-vous" description="Pour un rendez-vous pris par téléphone ou au cabinet." />
      <NewAppointmentForm
        services={svc}
        members={team}
        customers={clients}
        defaultDate={day}
        defaultTime={parseQuickTime(params.heure ?? "") ?? undefined}
        defaultMemberId={team.some((m) => m.id === params.membre) ? params.membre : undefined}
        defaultCustomerId={params.client}
        clientTerm={term}
      />
    </div>
  );
}
