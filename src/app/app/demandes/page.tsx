import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Mail, MessageSquare, Phone } from "lucide-react";
import { ReleaseAllExpired } from "@/components/agenda/release-expired";
import { RequestActions } from "@/components/app/request-actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { clientWord } from "@/lib/terminology";
import { formatDay, formatTime } from "@/lib/time";
import { listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Demandes" };

export default async function RequestsPage() {
  const ctx = await requireContext("appointments.manage");
  const tz = ctx.business.timezone;
  const now = new Date();
  const all = await listPendingRequests(ctx.business.id);
  const current = all.filter((r) => r.startsAt >= now);
  const expired = all.filter((r) => r.startsAt < now);
  const terms = clientWord(ctx.business.businessType, { plural: true });

  const row = (r: (typeof all)[number], isExpired: boolean) => (
    <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <Link href={`/app/agenda/rdv/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
        <p className="text-sm">
          <span className="first-letter:uppercase">{formatDay(r.startsAt, tz, "EEEE d MMMM")}</span> à {formatTime(r.startsAt, tz)} · {r.serviceName ?? "Rendez-vous"}
          {r.memberName ? ` · avec ${r.memberName}` : ""}
        </p>
        <p className="flex flex-wrap gap-x-4 text-sm text-muted">
          {r.phone ? <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-text"><Phone className="size-3.5" aria-hidden="true" />{r.phone}</a> : null}
          {r.email ? <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 break-all hover:text-text"><Mail className="size-3.5" aria-hidden="true" />{r.email}</a> : null}
        </p>
        {r.message ? <p className="flex gap-1.5 text-sm text-muted"><MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="whitespace-pre-line">{r.message}</span></p> : null}
      </div>
      <RequestActions id={r.id} expired={isExpired} />
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Demandes de rendez-vous" description="Ces créneaux sont déjà réservés en votre nom le temps que vous décidiez : personne d'autre ne peut les prendre." />
      <div className="space-y-6">
        <Card>
          {current.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Aucune demande en attente" description="Tout est traité. Les nouvelles demandes apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-border">{current.map((r) => row(r, false))}</ul>
          )}
        </Card>
        {expired.length ? (
          <Card>
            <CardHeader title="Demandes expirées" description={`Leur date est passée : il n'y a plus rien à confirmer. Libérez-les pour les retirer de la liste (les ${terms} ne sont pas prévenus).`} action={<ReleaseAllExpired count={expired.length} />} />
            <ul className="divide-y divide-border">{expired.map((r) => row(r, true))}</ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
