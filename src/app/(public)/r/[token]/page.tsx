import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, Clock, Hourglass, MapPin, UserRound, XCircle } from "lucide-react";
import { CancelButton } from "@/components/booking/cancel-button";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { formatDay, formatTime } from "@/lib/time";
import { getAppointmentByToken } from "@/server/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre rendez-vous", robots: { index: false } };

export default async function ManageAppointmentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const { token } = await params;
  const row = await getAppointmentByToken(token);
  if (!row) notFound();
  const { a, business: b, memberName } = row;
  const isNew = (await searchParams).nouveau === "1";
  const tz = b.timezone;
  const past = a.startsAt <= new Date();
  const address = [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  const state =
    a.status === "cancelled"
      ? { icon: XCircle, tone: "text-danger", title: "Rendez-vous annulé", text: "Ce rendez-vous a été annulé." }
      : a.status === "pending"
        ? { icon: Hourglass, tone: "text-warning", title: isNew ? "Demande envoyée" : "En attente de confirmation", text: `${b.name} doit encore confirmer votre rendez-vous.` }
        : { icon: CheckCircle2, tone: "text-success", title: isNew ? "Rendez-vous confirmé" : "Votre rendez-vous", text: past ? "Ce rendez-vous est passé." : "Tout est en ordre, à bientôt !" };

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <main className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="text-center">
            <state.icon className={`mx-auto size-10 ${state.tone}`} aria-hidden="true" />
            <h1 className="mt-3 text-xl font-semibold">{state.title}</h1>
            <p className="mt-1 text-sm text-muted">{state.text}</p>
          </div>

          <dl className="mt-6 space-y-3 rounded-lg bg-surface-muted p-4 text-sm">
            <div>
              <dt className="sr-only">Prestation</dt>
              <dd className="font-semibold">{a.serviceName}</dd>
              <dd className="text-muted">{b.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt><Clock className="size-4 text-muted" aria-label="Date" /></dt>
              <dd className={a.status === "cancelled" ? "line-through" : ""}>
                {formatDay(a.startsAt, tz, "EEEE d MMMM yyyy").replace(/^./, (c) => c.toUpperCase())} à {formatTime(a.startsAt, tz)}
              </dd>
            </div>
            {memberName ? (
              <div className="flex gap-3">
                <dt><UserRound className="size-4 text-muted" aria-label="Praticien" /></dt>
                <dd>Avec {memberName}</dd>
              </div>
            ) : null}
            {address ? (
              <div className="flex gap-3">
                <dt><MapPin className="size-4 text-muted" aria-label="Adresse" /></dt>
                <dd>{address}</dd>
              </div>
            ) : null}
          </dl>

          {a.status !== "cancelled" && !past ? (
            <div className="mt-6 space-y-3">
              <ButtonLink href={`/r/${token}/calendrier.ics`} variant="secondary" className="w-full" icon={<CalendarPlus className="size-4" aria-hidden="true" />} prefetch={false}>
                Ajouter à mon agenda
              </ButtonLink>
              <CancelButton token={token} />
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-muted">
            Conservez ce lien pour retrouver ou annuler votre rendez-vous.
            {b.phone ? <> Une question ? <a href={`tel:${b.phone}`} className="font-medium text-accent hover:text-accent-hover">{b.phone}</a></> : null}
          </p>
        </div>
        <p className="mt-6 text-center">
          <Link href={`/${b.slug}`} className="text-sm font-medium text-accent hover:text-accent-hover">
            Reprendre rendez-vous chez {b.name}
          </Link>
        </p>
      </main>
      <footer className="mt-10 opacity-80">
        <Brand />
      </footer>
    </div>
  );
}
