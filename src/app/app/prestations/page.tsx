import type { Metadata } from "next";
import { Plus, Scissors } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, serviceCategories, serviceHours, serviceIntakeRules, serviceMembers, services } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceTabs } from "@/components/services/service-tabs";
import { ServicesList } from "@/components/services/services-list";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Prestations" };

export default async function ServicesPage() {
  const ctx = await requireContext("services.view");
  const bid = ctx.business.id;
  const canManage = ctx.can("services.manage");

  const [rows, cats, links, team, hours, rules] = await Promise.all([
    db.select().from(services).where(eq(services.businessId, bid)).orderBy(asc(services.position), asc(services.name)),
    db.select().from(serviceCategories).where(eq(serviceCategories.businessId, bid)).orderBy(asc(serviceCategories.position)),
    db.select({ serviceId: serviceMembers.serviceId, name: members.displayName }).from(serviceMembers).innerJoin(members, eq(members.id, serviceMembers.memberId)),
    db.select({ id: members.id }).from(members).where(and(eq(members.businessId, bid), eq(members.isBookable, true), eq(members.status, "active"))),
    db.selectDistinct({ serviceId: serviceHours.serviceId }).from(serviceHours).innerJoin(services, eq(services.id, serviceHours.serviceId)).where(eq(services.businessId, bid)),
    db.selectDistinct({ serviceId: serviceIntakeRules.serviceId }).from(serviceIntakeRules).innerJoin(services, eq(services.id, serviceIntakeRules.serviceId)).where(eq(services.businessId, bid)),
  ]);
  const hasHours = new Set(hours.map((h) => h.serviceId));
  const hasRules = new Set(rules.map((r) => r.serviceId));

  const whoDoes = (serviceId: string) => {
    const names = links.filter((l) => l.serviceId === serviceId).map((l) => l.name);
    return names.length === 0 || names.length === team.length ? "Toute l'équipe" : names.join(", ");
  };

  return (
    <>
      <PageHeader
        title="Prestations"
        description={`${rows.filter((s) => s.isActive).length} prestation${rows.length > 1 ? "s" : ""} proposée${rows.length > 1 ? "s" : ""} en ligne`}
        action={canManage ? <ButtonLink href="/app/prestations/nouvelle" icon={<Plus className="size-4" aria-hidden="true" />}>Nouvelle prestation</ButtonLink> : null}
      />
      {canManage ? <ServiceTabs /> : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Scissors />}
            title="Aucune prestation"
            description="Ajoutez vos prestations pour que vos clients puissent réserver."
            action={canManage ? <ButtonLink href="/app/prestations/nouvelle" icon={<Plus className="size-4" aria-hidden="true" />}>Créer ma première prestation</ButtonLink> : null}
          />
        </Card>
      ) : (
        <ServicesList
          canManage={canManage}
          categories={cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
          rows={rows.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            color: s.color,
            imageUrl: s.imageUrl,
            kind: s.kind,
            capacity: s.capacity,
            durationMin: s.durationMin,
            durationMaxMin: s.durationMaxMin,
            priceCents: s.priceCents,
            isActive: s.isActive,
            categoryId: s.categoryId,
            who: whoDoes(s.id),
            limitedHours: hasHours.has(s.id),
            byAnswers: hasRules.has(s.id),
          }))}
        />
      )}
    </>
  );
}
