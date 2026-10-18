import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, appointments, businesses, members, services, subscriptions, users } from "@/db/schema";
import { GrantPlanForm, PauseToggle } from "@/components/admin/admin-actions";
import { BusinessInfoForm, TypeToDelete } from "@/components/admin/platform";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { formatDay, formatTime, zoned } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";
import { effectivePlan } from "@/server/plan";

export const metadata: Metadata = { title: "Établissement" };

const PLAN: Record<string, string> = { free: "Gratuit", pro: "Pro", pro_plus: "Pro+" };

/**
 * Fiche établissement côté super-admin.
 * Volontairement sans données clients (dossiers, notes) : ce sont des données de santé.
 */
export default async function AdminBusiness({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [row] = await db
    .select({ b: businesses, owner: { id: users.id, name: users.fullName, email: users.email, lastLoginAt: users.lastLoginAt }, sub: subscriptions })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .leftJoin(subscriptions, eq(subscriptions.userId, businesses.ownerId))
    .where(eq(businesses.id, id.data));
  if (!row) notFound();
  const { b, owner } = row;
  const tz = b.timezone;
  const d30 = new Date(new Date().getTime() - 30 * 86400000);

  const [team, nbServices, appts30, logs] = await Promise.all([
    db.select({ id: members.id, name: members.displayName, isOwner: members.isOwner, status: members.status, email: users.email }).from(members).leftJoin(users, eq(users.id, members.userId)).where(eq(members.businessId, b.id)).orderBy(asc(members.createdAt)),
    db.select({ n: count() }).from(services).where(eq(services.businessId, b.id)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(appointments).where(and(eq(appointments.businessId, b.id), eq(appointments.kind, "appointment"), gte(appointments.createdAt, d30))).then((r) => r[0]?.n ?? 0),
    db.select({ id: activityLogs.id, at: activityLogs.createdAt, actor: activityLogs.actorName, description: activityLogs.description }).from(activityLogs).where(eq(activityLogs.businessId, b.id)).orderBy(desc(activityLogs.createdAt)).limit(10),
  ]);

  const eff = await effectivePlan(b.id);
  const granted = eff.source === "granted" ? eff.grantedUntil : null;
  const plan = eff.plan;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/etablissements" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Établissements
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
            {b.pausedAt ? <Badge tone="warning">En pause</Badge> : <Badge tone="success">Actif</Badge>}
            {b.deletedAt ? <Badge tone="danger">Supprimé</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">{[b.businessType, b.city].filter(Boolean).join(" · ") || "—"} · créé le {formatDay(b.createdAt, tz, "d MMMM yyyy")}</p>
        </div>
        <a href={`/${b.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover">
          Page publique
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Membres actifs", value: team.filter((m) => m.status === "active").length },
            { label: "Prestations", value: nbServices },
            { label: "RDV créés (30 j)", value: appts30 },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader title="Propriétaire" />
          <div className="space-y-1 p-5 text-sm">
            <Link href={`/admin/utilisateurs/${owner.id}`} className="font-medium hover:underline">{owner.name}</Link>
            <p className="text-muted">{owner.email}</p>
            <p className="text-muted">Dernière connexion : {owner.lastLoginAt ? `${formatDay(owner.lastLoginAt, tz, "d MMM yyyy")} à ${formatTime(owner.lastLoginAt, tz)}` : "jamais"}</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Forfait" description={`Actuel : ${PLAN[plan]}${eff.source === "granted" ? (granted ? ` (offert jusqu'au ${formatDay(granted, tz, "d MMMM yyyy")})` : " (offert)") : eff.source === "stripe" ? " (Stripe)" : eff.source === "account" ? " (ancien abonnement du compte)" : ""}`} />
          <div className="p-5">
            <GrantPlanForm businessId={b.id} plan={plan} until={granted ? format(zoned(granted, tz), "yyyy-MM-dd") : ""} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Réservation en ligne" description={b.pausedAt ? `En pause depuis le ${formatDay(b.pausedAt, tz, "d MMMM yyyy")}.` : "Les clients peuvent réserver sur la page publique."} />
          <div className="p-5">
            <PauseToggle id={b.id} paused={!!b.pausedAt} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Équipe" />
          <ul className="divide-y divide-border">
            {team.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="font-medium">{m.name}</span>
                {m.isOwner ? <Badge tone="accent">Propriétaire</Badge> : null}
                {m.status !== "active" ? <Badge>{m.status === "invited" ? "Invité" : m.status === "requested" ? "Demande" : "Refusé"}</Badge> : null}
                <span className="ml-auto text-muted">{m.email ?? "sans compte"}</span>
              </li>
            ))}
          </ul>
        </Card>

        {!b.deletedAt ? (
          <Card>
            <CardHeader title="Informations" description="Corriger le nom, l'adresse de la page, le métier ou les coordonnées." />
            <BusinessInfoForm id={b.id} initial={{ name: b.name, businessType: b.businessType ?? "", city: b.city ?? "", email: b.email ?? "", phone: b.phone ?? "", slug: b.slug }} />
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Activité récente" />
          {logs.length === 0 ? (
            <p className="p-5 text-sm text-muted">Aucune activité.</p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="px-5 py-3 text-sm">
                  <p>{l.description}</p>
                  <p className="text-muted">{l.actor} · {formatDay(l.at, tz, "d MMM")} à {formatTime(l.at, tz)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!b.deletedAt ? (
          <Card className="p-5">
            <TypeToDelete kind="business" id={b.id} expected={b.name} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
