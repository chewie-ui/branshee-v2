import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { businesses, members, supervisionRequests, users } from "@/db/schema";
import { DisableUserButton } from "@/components/admin/admin-actions";
import { SupervisionControl, TypeToDelete } from "@/components/admin/platform";
import { AutoRefresh } from "@/components/admin/relations";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDay, formatTime } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Utilisateur" };
const TZ = "Europe/Brussels";

/** Fiche d'un compte côté super-admin (sans données de clients ni de santé). */
export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [u] = await db.select().from(users).where(eq(users.id, id.data));
  if (!u) notFound();
  const [memberships, [referrer], referred, [lastRequest], [support]] = await Promise.all([
    db
      .select({ id: businesses.id, name: businesses.name, isOwner: members.isOwner, status: members.status, deletedAt: businesses.deletedAt })
      .from(members)
      .innerJoin(businesses, eq(businesses.id, members.businessId))
      .where(eq(members.userId, u.id))
      .orderBy(desc(members.isOwner), businesses.name),
    u.referredById ? db.select({ id: users.id, name: users.fullName }).from(users).where(eq(users.id, u.referredById)) : Promise.resolve([]),
    db.select({ id: users.id, name: users.fullName, paid: users.referralPaidAt }).from(users).where(eq(users.referredById, u.id)).orderBy(desc(users.createdAt)).limit(50),
    db.select().from(supervisionRequests).where(and(eq(supervisionRequests.userId, u.id), eq(supervisionRequests.requestedById, admin.id))).orderBy(desc(supervisionRequests.createdAt)).limit(1),
    db.execute<{ n: number }>(sql`select count(*)::int as n from support_messages where thread_user_id = ${u.id}`),
  ]);
  const now = new Date();
  const live = lastRequest && lastRequest.expiresAt && lastRequest.expiresAt > now;
  const supervision =
    !lastRequest || lastRequest.status === "closed"
      ? { status: "none" as const }
      : !live
        ? { status: lastRequest.status === "refused" ? ("refused" as const) : ("expired" as const) }
        : { status: lastRequest.status as "pending" | "accepted" | "refused", requestId: lastRequest.id };
  const deleted = u.email.endsWith("@branshee.invalid");

  return (
    <div className="mx-auto max-w-3xl">
      {supervision.status === "pending" ? <AutoRefresh seconds={5} /> : null}
      <Link href="/admin/utilisateurs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Utilisateurs
      </Link>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{u.fullName}</h1>
          {u.isSuperadmin ? <Badge tone="accent">Super-admin</Badge> : null}
          {u.disabledAt ? <Badge tone="danger">Désactivé</Badge> : null}
          {u.emailVerifiedAt ? <Badge tone="success">Email vérifié</Badge> : <Badge>Email non vérifié</Badge>}
          {u.twoFactorSecret ? <Badge tone="success">2FA</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
        <p className="text-sm text-muted">
          Inscrit le {formatDay(u.createdAt, TZ, "d MMMM yyyy")} · {u.lastLoginAt ? `vu le ${formatDay(u.lastLoginAt, TZ, "d MMM yyyy")} à ${formatTime(u.lastLoginAt, TZ)}` : "jamais connecté"}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Établissements" />
          {memberships.length === 0 ? (
            <p className="p-5 text-sm text-muted">Compte client (aucun établissement).</p>
          ) : (
            <ul className="divide-y divide-border">
              {memberships.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                  <Link href={`/admin/etablissements/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                  {m.isOwner ? <Badge tone="accent">Propriétaire</Badge> : <Badge>Membre</Badge>}
                  {m.status !== "active" ? <Badge>{m.status}</Badge> : null}
                  {m.deletedAt ? <Badge tone="danger">Supprimé</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Parrainage" description={`Code : ${u.referralCode ?? "—"}`} />
          <div className="space-y-2 p-5 text-sm">
            <p>Parrain : {referrer ? <Link href={`/admin/utilisateurs/${referrer.id}`} className="font-medium hover:underline">{referrer.name}</Link> : "aucun"}</p>
            <p>Filleuls : {referred.length} dont {referred.filter((r) => r.paid).length} payant{referred.filter((r) => r.paid).length > 1 ? "s" : ""}</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Support" description={support?.n ? `${support.n} message${support.n > 1 ? "s" : ""} échangé${support.n > 1 ? "s" : ""}` : "Aucun échange"} action={support?.n ? <Link href={`/admin/support?u=${u.id}`} className="text-sm font-medium text-accent hover:text-accent-hover">Ouvrir</Link> : null} />
        </Card>

        {!deleted && !u.isSuperadmin ? (
          <Card>
            <CardHeader title="Voir son espace" description="Le pro reçoit une demande dans son espace et doit l'accepter. La session dure 2 h au plus, apparaît dans son journal, et il peut y mettre fin à tout moment." />
            <div className="p-5">
              <SupervisionControl userId={u.id} state={supervision} />
            </div>
          </Card>
        ) : null}

        {!deleted && u.id !== admin.id ? (
          <Card className="flex flex-wrap items-start gap-3 p-5">
            <DisableUserButton id={u.id} disabled={!!u.disabledAt} />
            {!u.isSuperadmin ? <TypeToDelete kind="user" id={u.id} expected={u.email} /> : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
