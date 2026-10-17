import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Scissors, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, serviceCategories, serviceMembers, services } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDuration, formatPrice } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Prestations" };

export default async function ServicesPage() {
  const ctx = await requireContext("services.view");
  const bid = ctx.business.id;
  const canManage = ctx.can("services.manage");

  const [rows, cats, links, team] = await Promise.all([
    db.select().from(services).where(eq(services.businessId, bid)).orderBy(asc(services.position), asc(services.name)),
    db.select().from(serviceCategories).where(eq(serviceCategories.businessId, bid)).orderBy(asc(serviceCategories.position)),
    db.select({ serviceId: serviceMembers.serviceId, name: members.displayName }).from(serviceMembers).innerJoin(members, eq(members.id, serviceMembers.memberId)),
    db.select({ id: members.id }).from(members).where(and(eq(members.businessId, bid), eq(members.isBookable, true), eq(members.status, "active"))),
  ]);

  const groups = [
    ...cats.map((c) => ({ key: c.id, name: c.name, items: rows.filter((s) => s.categoryId === c.id) })),
    { key: "none", name: cats.length ? "Sans catégorie" : "Toutes les prestations", items: rows.filter((s) => !s.categoryId) },
  ].filter((g) => g.items.length > 0);

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
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g.key} className="overflow-hidden">
              <h2 className="border-b border-border bg-surface-muted px-5 py-2.5 text-sm font-semibold">{g.name}</h2>
              <ul className="divide-y divide-border">
                {g.items.map((s) => {
                  const Row = canManage ? Link : "div";
                  return (
                  <li key={s.id}>
                    <Row href={`/app/prestations/${s.id}`} className={`flex flex-col gap-2 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4 ${canManage ? "hover:bg-surface-muted/60" : ""}`}>
                    <span className="hidden size-3 shrink-0 rounded-full sm:block" style={{ background: s.color ?? "var(--accent)" }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {s.name}
                        {s.kind === "group" ? <Badge tone="accent">Cours collectif{s.capacity ? ` · ${s.capacity} places` : ""}</Badge> : null}
                        {!s.isActive ? <Badge>Masquée</Badge> : null}
                      </p>
                      {s.description ? <p className="mt-0.5 line-clamp-1 text-sm text-muted">{s.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4" aria-hidden="true" />
                        {whoDoes(s.id)}
                      </span>
                      <span className="tabular-nums">{formatDuration(s.durationMin, s.durationMaxMin)}</span>
                      <span className="w-16 text-right font-medium text-text tabular-nums">{formatPrice(s.priceCents)}</span>
                      {canManage ? <ChevronRight className="hidden size-4 text-muted sm:block" aria-hidden="true" /> : null}
                    </div>
                    </Row>
                  </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
