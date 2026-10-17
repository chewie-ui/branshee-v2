import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Hourglass, MapPin, Star, UserRound, XCircle } from "lucide-react";
import { format } from "date-fns";
import { AddToCalendar } from "@/components/booking/add-to-calendar";
import { CancelButton } from "@/components/booking/cancel-button";
import { RescheduleWidget } from "@/components/booking/reschedule-widget";
import { zoned } from "@/lib/time";
import { getSessionUser } from "@/server/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointmentPayments, paymentSettings } from "@/db/schema";
import { cancellationQuote } from "@/server/payments";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { formatDay, formatTime } from "@/lib/time";
import { getAppointmentByToken } from "@/server/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre rendez-vous", robots: { index: false } };

export default async function ManageAppointmentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nouveau?: string; deplacer?: string }> }) {
  const { token } = await params;
  const row = await getAppointmentByToken(token);
  if (!row) notFound();
  const { a, business: b, memberName } = row;
  const sp = await searchParams;
  const isNew = sp.nouveau === "1";
  const session = await getSessionUser();
  const tz = b.timezone;
  const past = a.startsAt <= new Date();
  const address = b.locationMode === "online" ? "En ligne" : [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const today = format(zoned(new Date(), tz), "yyyy-MM-dd");
  const [[pay], [ps], quote] = await Promise.all([
    db.select().from(appointmentPayments).where(eq(appointmentPayments.appointmentId, a.id)),
    db.select({ accepted: paymentSettings.accepted }).from(paymentSettings).where(eq(paymentSettings.businessId, b.id)),
    a.status !== "cancelled" && !past ? cancellationQuote(a.id) : Promise.resolve(null),
  ]);
  const euros = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const acc = ps?.accepted;
  const canMove = a.status !== "cancelled" && !past && !a.groupSessionId && !!a.serviceId && !!a.memberId;

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

          {pay && a.status !== "cancelled" ? (
            <div className="mt-4 space-y-2 rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">Paiement</p>
              {pay.status === "paid" ? <p className="text-success">Payé en ligne : {euros(pay.amountCents)}{pay.cardLast4 ? ` (carte •••• ${pay.cardLast4})` : ""}</p> : null}
              {pay.status === "authorized" ? <p className="text-muted">Carte •••• {pay.cardLast4} enregistrée en garantie. À régler sur place : {euros(pay.amountCents)}.</p> : null}
              {pay.status === "none" && pay.method === "bank_transfer" && acc?.bankTransfer.iban ? (
                <div className="text-muted">
                  <p>À régler par virement : <span className="font-medium text-text">{euros(pay.amountCents)}</span></p>
                  <p>IBAN : <span className="font-mono text-text">{acc.bankTransfer.iban}</span>{acc.bankTransfer.bic ? ` · BIC ${acc.bankTransfer.bic}` : ""}</p>
                  {acc.bankTransfer.bankName ? <p>Banque : {acc.bankTransfer.bankName}</p> : null}
                  {acc.bankTransfer.note ? <p>Communication : {acc.bankTransfer.note}</p> : null}
                </div>
              ) : null}
              {pay.status === "none" && pay.method === "paypal" && acc?.paypal.paypalMe ? (
                <a href={`https://paypal.me/${acc.paypal.paypalMe}/${(pay.amountCents / 100).toFixed(2)}EUR`} target="_blank" rel="noopener noreferrer" className="inline-flex font-medium text-accent hover:text-accent-hover">Payer {euros(pay.amountCents)} avec PayPal</a>
              ) : null}
              {pay.status === "none" && pay.method === "on_site" ? <p className="text-muted">À régler sur place : {euros(pay.amountCents)}.</p> : null}
              {acc?.qrCode.enabled && acc.qrCode.imageUrl && pay.status !== "paid" ? (
                <div className="flex items-center gap-3 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={acc.qrCode.imageUrl} alt="QR code de paiement" className="size-24 rounded-lg border border-border bg-white object-contain" />
                  {acc.qrCode.note ? <p className="text-muted">{acc.qrCode.note}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {quote && quote.feeCents > 0 ? (
            <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">
              Annuler maintenant entraîne {euros(quote.feeCents)} de frais{quote.paid ? ` (vous seriez remboursé de ${euros(quote.totalCents - quote.feeCents)})` : " prélevés sur votre carte"}, selon la politique d&apos;annulation de l&apos;établissement.
            </p>
          ) : null}

          {a.status !== "cancelled" && !past ? (
            <div className="mt-6 space-y-3">
              <AddToCalendar token={token} title={`${a.serviceName ?? "Rendez-vous"} — ${b.name}`} start={a.startsAt} end={a.endsAt} location={address || null} details={memberName ? `Avec ${memberName}` : null} />
              {canMove ? <RescheduleWidget token={token} today={today} defaultOpen={sp.deplacer === "1"} /> : null}
              <CancelButton token={token} />
            </div>
          ) : null}

          {past && a.status === "confirmed" ? (
            <ButtonLink href={`/${b.slug}#avis`} variant="secondary" className="mt-6 w-full" icon={<Star className="size-4" aria-hidden="true" />}>
              Laisser un avis sur {b.name}
            </ButtonLink>
          ) : null}

          {!session && a.contactEmail ? (
            <div className="mt-6 rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm">
              <p className="font-medium text-accent-soft-foreground">Retrouvez tous vos rendez-vous au même endroit</p>
              <p className="mt-1 text-muted">Créez votre compte client : déplacer, annuler ou reprendre rendez-vous en un clic.</p>
              <ButtonLink href={`/inscription?client=1&email=${encodeURIComponent(a.contactEmail)}&nom=${encodeURIComponent(a.contactName ?? "")}&suite=${encodeURIComponent("/espace-client")}`} size="sm" className="mt-3">
                Créer mon compte
              </ButtonLink>
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
