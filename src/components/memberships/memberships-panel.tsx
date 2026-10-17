import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { listMemberships } from "@/server/memberships";
import { CancelRequestButton, InvitationButtons, JoinSearch, LeaveButton, OwnerControls } from "./membership-actions";

type Rows = Awaited<ReturnType<typeof listMemberships>>;

/** Invitations reçues + demandes envoyées + recherche pour rejoindre (partagé entre Bienvenue et Mes établissements). */
export function InvitationsAndJoin({ rows }: { rows: Rows }) {
  const invitations = rows.filter((r) => r.status === "invited");
  const requests = rows.filter((r) => r.status === "requested");
  return (
    <div className="space-y-6">
      {invitations.length ? (
        <Card>
          <CardHeader title="Invitations reçues" />
          <ul className="divide-y divide-border">
            {invitations.map((r) => (
              <li key={r.memberId} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar name={r.business.name} src={r.business.photoUrl} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{r.business.name}</p>
                  <p className="text-muted">{[r.business.businessType, r.business.city].filter(Boolean).join(" · ")}</p>
                </div>
                <InvitationButtons memberId={r.memberId} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {requests.length ? (
        <Card>
          <CardHeader title="Demandes envoyées" description="En attente de réponse de l'établissement." />
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.memberId} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                <span className="flex-1 font-medium">{r.business.name}</span>
                <CancelRequestButton memberId={r.memberId} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Rejoindre un établissement" description="Vous travaillez dans un cabinet déjà sur Branshee ? Envoyez une demande au responsable." />
        <div className="p-5"><JoinSearch /></div>
      </Card>
    </div>
  );
}

export function MyBusinesses({ rows, userId: _userId }: { rows: Rows; userId: string }) {
  const active = rows.filter((r) => r.status === "active");
  return (
    <Card>
      <CardHeader title="Mes établissements" />
      <ul className="divide-y divide-border">
        {active.map((r) => (
          <li key={r.memberId} className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={r.business.name} src={r.business.photoUrl} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {r.business.name}
                  {r.isOwner ? <Badge tone="accent">Propriétaire</Badge> : r.gradeName ? <Badge>{r.gradeName}</Badge> : null}
                  {r.business.pausedAt ? <Badge tone="warning">En pause</Badge> : null}
                </p>
                <p className="text-muted">{[r.business.businessType, r.business.city].filter(Boolean).join(" · ")}</p>
              </div>
              <Link href={`/${r.business.slug}`} target="_blank" className="text-sm font-medium text-accent hover:text-accent-hover">Voir la page</Link>
            </div>
            {r.isOwner ? <OwnerControls businessId={r.business.id} name={r.business.name} paused={!!r.business.pausedAt} /> : <LeaveButton businessId={r.business.id} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
