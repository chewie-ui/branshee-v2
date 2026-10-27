import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveList, PendingList, RequestLeaveButton } from "@/components/leave/leave-ui";
import { fmtDays } from "@/lib/leave";
import { requireContext } from "@/server/context";
import { leaveBalances, leaveMembers, leaveRights, listLeave } from "@/server/leave";

export const metadata: Metadata = { title: "Congés" };

const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Congés : demandes à valider, mon solde, absences à venir et passées. */
export default async function LeavePage() {
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const year = Number(today.slice(0, 4));
  const rights = leaveRights(ctx);
  const [members, all, balances] = await Promise.all([leaveMembers(ctx), listLeave(ctx), leaveBalances(ctx, year, today)]);
  const pending = rights.approve ? all.filter((l) => l.status === "pending").sort((a, b) => a.start.localeCompare(b.start)) : [];
  const upcoming = all.filter((l) => l.end >= today && (l.status === "approved" || (l.status === "pending" && !rights.approve))).sort((a, b) => a.start.localeCompare(b.start));
  const past = all.filter((l) => l.end < today || l.status === "refused").slice(0, 30);
  const mine = balances.find((b) => b.memberId === ctx.member.id);
  const left = mine && mine.allowance !== null ? mine.allowance - mine.taken - mine.planned : null;
  const showName = rights.seeAll && members.length > 1;

  return (
    <>
      <PageHeader title="Congés" description={rights.approve ? "Demandes de l'équipe, absences à venir et soldes." : "Vos demandes et votre solde de congés."} action={<RequestLeaveButton members={members} me={ctx.member.id} canApprove={rights.approve} today={today} />} />
      <div className="space-y-6">
        {rights.approve ? (
          <Card>
            <CardHeader title="À valider" description={pending.length ? `${pending.length} demande${pending.length > 1 ? "s" : ""} en attente` : "Aucune demande en attente."} />
            <PendingList items={pending} />
          </Card>
        ) : null}

        {mine ? (
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {[
              { label: `Solde ${year}`, value: left === null ? "Non suivi" : fmtDays(Math.max(0, left)), hint: left === null ? "Votre responsable n'a pas encore indiqué vos jours." : left < 0 ? `Dépassé de ${fmtDays(-left)}` : `sur ${fmtDays(mine.allowance!)}` },
              { label: "Pris", value: fmtDays(mine.taken), hint: "Congés passés cette année" },
              { label: "Prévus", value: fmtDays(mine.planned), hint: "Validés, à venir" },
              { label: "En attente", value: fmtDays(mine.pending), hint: "Pas encore validés" },
            ].map((k) => (
              <div key={k.label}>
                <p className="text-sm text-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
                <p className="text-xs text-muted">{k.hint}</p>
              </div>
            ))}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="À venir" description={upcoming.length ? undefined : "Aucune absence prévue."} />
          {upcoming.length ? <LeaveList items={upcoming} me={ctx.member.id} canApprove={rights.approve} today={today} showName={showName} /> : null}
        </Card>

        {past.length ? (
          <details className="group rounded-xl border border-border bg-surface">
            <summary className="cursor-pointer px-5 py-4 font-semibold">Historique <span className="font-normal text-muted">({past.length})</span></summary>
            <div className="border-t border-border"><LeaveList items={past} me={ctx.member.id} canApprove={rights.approve} today={today} showName={showName} /></div>
          </details>
        ) : null}
      </div>
    </>
  );
}
