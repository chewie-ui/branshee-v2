import { appPagePath } from "@/lib/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Navigation, RotateCcw, Star, UserRound } from "lucide-react";
import { AddToCalendar } from "@/components/booking/add-to-calendar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDay, formatTime } from "@/lib/time";
import { listClientAppointments, listMyReviews, requireClient } from "@/server/client-account";

export const metadata: Metadata = { title: "Mes rendez-vous" };

type Appt = Awaited<ReturnType<typeof listClientAppointments>>[number];

const addr = (b: Appt["business"]) => (b.locationMode === "online" ? null : [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function MyAppointments() {
  const user = await requireClient("/espace-client/rendez-vous");
  const [list, myReviews] = await Promise.all([listClientAppointments(user.id), listMyReviews(user.id)]);
  const now = new Date();
  const upcoming = list.filter((a) => a.startsAt > now && a.status !== "cancelled").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = list.filter((a) => a.startsAt <= now || a.status === "cancelled");
  const reviewed = new Set(myReviews.map((r) => r.business.id));
  // « Laisser un avis » une seule fois par pro (sur le dernier RDV honoré), pas sur chaque ligne.
  const reviewOn = new Set<string>();
  const asked = new Set(reviewed);
  for (const a of past) if (a.status !== "cancelled" && !asked.has(a.business.id)) { asked.add(a.business.id); reviewOn.add(a.id); }
  const row = (a: Appt) => (
    <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{a.serviceName ?? "Rendez-vous"} · {a.business.name}</p>
        <p className="text-muted">
          {cap(formatDay(a.startsAt, a.business.timezone, "EEEE d MMMM yyyy"))}
          {a.status === "cancelled" ? " · annulé" : ""}
        </p>
      </div>
      {reviewOn.has(a.id) ? (
        <Link href={`${appPagePath(a.business.slug)}#avis`} className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"><Star className="size-4" aria-hidden="true" />Laisser un avis</Link>
      ) : null}
    </li>
  );
  // Mes pros : les établissements où j'ai déjà eu rendez-vous (pour reprendre RDV en un clic).
  const mine = [...new Map(list.filter((a) => !a.business.pausedAt).map((a) => [a.business.id, a.business])).values()].slice(0, 9);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mes rendez-vous</h1>
      <section className="space-y-3" aria-labelledby="a-venir">
        <h2 id="a-venir" className="text-lg font-semibold">À venir</h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">
            <CalendarDays className="mx-auto mb-2 size-8" aria-hidden="true" />
            <p>Aucun rendez-vous à venir. Vos réservations chez les pros sur Skydev apparaissent ici, avec l&apos;adresse {user.email}.</p>
            <ButtonLink href="/annuaire" size="sm" className="mt-4">Trouver un pro</ButtonLink>
          </Card>
        ) : (
          upcoming.map((a) => {
            const address = addr(a.business);
            const tz = a.business.timezone;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <Avatar name={a.business.name} src={a.business.photoUrl} size="lg" />
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{a.serviceName ?? "Rendez-vous"}</span>
                        {a.status === "pending" ? <Badge tone="warning">En attente de confirmation</Badge> : null}
                      </p>
                      <p className="font-medium">{a.business.name}</p>
                      <p className="flex items-center gap-2 text-muted"><Clock className="size-4" aria-hidden="true" />{cap(formatDay(a.startsAt, tz, "EEEE d MMMM"))} à {formatTime(a.startsAt, tz)}</p>
                      {a.memberName ? <p className="flex items-center gap-2 text-muted"><UserRound className="size-4" aria-hidden="true" />Avec {a.memberName}</p> : null}
                      <p className="flex items-center gap-2 text-muted"><MapPin className="size-4" aria-hidden="true" />{address ?? "En ligne"}</p>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-52">
                    <AddToCalendar token={a.token} title={`${a.serviceName ?? "Rendez-vous"} — ${a.business.name}`} start={a.startsAt} end={a.endsAt} location={address} details={a.memberName ? `Avec ${a.memberName}` : null} />
                    <ButtonLink href={`/r/${a.token}?deplacer=1`} variant="secondary" size="sm">Déplacer</ButtonLink>
                    <ButtonLink href={`/r/${a.token}`} variant="ghost" size="sm">Annuler ou voir le détail</ButtonLink>
                    {address ? (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${a.business.name} ${address}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover">
                        <Navigation className="size-4" aria-hidden="true" />Itinéraire
                      </a>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      {mine.length ? (
        <section className="space-y-3" aria-labelledby="mes-pros">
          <h2 id="mes-pros" className="text-lg font-semibold">Mes pros</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((b) => (
              <li key={b.id}>
                <Card className="flex items-center gap-3 p-4">
                  <Avatar name={b.name} src={b.photoUrl} />
                  <Link href={appPagePath(b.slug)} className="min-w-0 flex-1 truncate font-medium hover:text-accent">{b.name}</Link>
                  <ButtonLink href={appPagePath(b.slug)} size="sm" variant="secondary" icon={<RotateCcw className="size-4" aria-hidden="true" />}>Réserver</ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Historique</h2>
          <Card>
            <ul className="divide-y divide-border">{past.slice(0, 8).map(row)}</ul>
            {past.length > 8 ? (
              <details className="group border-t border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center px-5 text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent group-open:hidden">Voir tout l&apos;historique ({past.length})</summary>
                <ul className="divide-y divide-border">{past.slice(8, 120).map(row)}</ul>
              </details>
            ) : null}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
