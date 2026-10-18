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
import { formatTime } from "@/lib/time";
import { getAppointmentByToken } from "@/server/manage";
import { createT, getMessages, intlLocale } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import { resolvePublicLocale } from "@/i18n/server";
import { LanguageSwitcher } from "@/components/public/language-switcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre rendez-vous", robots: { index: false } };

export default async function ManageAppointmentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nouveau?: string; deplacer?: string; lang?: string }> }) {
  const { token } = await params;
  const row = await getAppointmentByToken(token);
  if (!row) notFound();
  const { a, business: b, memberName } = row;
  const sp = await searchParams;
  const isNew = sp.nouveau === "1";
  const locale = await resolvePublicLocale(sp.lang, a.locale);
  const t = createT(getMessages(locale));
  const longDate = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: b.timezone }).format(a.startsAt).replace(/^./, (c) => c.toUpperCase());
  const session = await getSessionUser();
  const tz = b.timezone;
  const past = a.startsAt <= new Date();
  const address = b.locationMode === "online" ? t("common.online") : [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const today = format(zoned(new Date(), tz), "yyyy-MM-dd");
  const [[pay], [ps], quote] = await Promise.all([
    db.select().from(appointmentPayments).where(eq(appointmentPayments.appointmentId, a.id)),
    db.select({ accepted: paymentSettings.accepted }).from(paymentSettings).where(eq(paymentSettings.businessId, b.id)),
    a.status !== "cancelled" && !past ? cancellationQuote(a.id) : Promise.resolve(null),
  ]);
  const money = new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR" });
  const euros = (c: number) => money.format(c / 100);
  const acc = ps?.accepted;
  const canMove = a.status !== "cancelled" && !past && !a.groupSessionId && !!a.serviceId && !!a.memberId;

  const state =
    a.status === "cancelled"
      ? { icon: XCircle, tone: "text-danger", title: t("manage.cancelled"), text: t("manage.cancelledText") }
      : a.status === "pending"
        ? { icon: Hourglass, tone: "text-warning", title: isNew ? t("manage.requestSent") : t("manage.pending"), text: t("manage.pendingText", { name: b.name }) }
        : { icon: CheckCircle2, tone: "text-success", title: isNew ? t("manage.confirmed") : t("manage.yours"), text: past ? t("manage.pastText") : t("manage.allGood") };

  return (
    <I18nProvider locale={locale}>
    <div lang={locale} className="flex min-h-dvh flex-col items-center px-4 py-10">
      <main className="w-full max-w-md">
        <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="text-center">
            <state.icon className={`mx-auto size-10 ${state.tone}`} aria-hidden="true" />
            <h1 className="mt-3 text-xl font-semibold">{state.title}</h1>
            <p className="mt-1 text-sm text-muted">{state.text}</p>
          </div>

          <dl className="mt-6 space-y-3 rounded-lg bg-surface-muted p-4 text-sm">
            <div>
              <dt className="sr-only">{t("manage.service")}</dt>
              <dd className="font-semibold">{a.serviceName}</dd>
              <dd className="text-muted">{b.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt><Clock className="size-4 text-muted" aria-label={t("manage.date")} /></dt>
              <dd className={a.status === "cancelled" ? "line-through" : ""}>
                {t("common.at", { day: longDate, time: formatTime(a.startsAt, tz) })}
              </dd>
            </div>
            {memberName ? (
              <div className="flex gap-3">
                <dt><UserRound className="size-4 text-muted" aria-label={t("manage.practitioner")} /></dt>
                <dd>{t("common.with", { name: memberName })}</dd>
              </div>
            ) : null}
            {address ? (
              <div className="flex gap-3">
                <dt><MapPin className="size-4 text-muted" aria-label={t("manage.address")} /></dt>
                <dd>{address}</dd>
              </div>
            ) : null}
          </dl>

          {pay && a.status !== "cancelled" ? (
            <div className="mt-4 space-y-2 rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">{t("manage.payment")}</p>
              {pay.status === "paid" ? <p className="text-success">{t("manage.paidOnline", { amount: euros(pay.amountCents) })}{pay.cardLast4 ? t("manage.cardSuffix", { last4: pay.cardLast4 }) : ""}</p> : null}
              {pay.status === "authorized" ? <p className="text-muted">{t("manage.cardGuarantee", { last4: pay.cardLast4 ?? "", amount: euros(pay.amountCents) })}</p> : null}
              {pay.status === "none" && pay.method === "bank_transfer" && acc?.bankTransfer.iban ? (
                <div className="text-muted">
                  <p>{t("manage.toPayTransfer", { amount: euros(pay.amountCents) })}</p>
                  <p>IBAN : <span className="font-mono text-text">{acc.bankTransfer.iban}</span>{acc.bankTransfer.bic ? ` · BIC ${acc.bankTransfer.bic}` : ""}</p>
                  {acc.bankTransfer.bankName ? <p>{t("manage.bank", { name: acc.bankTransfer.bankName })}</p> : null}
                  {acc.bankTransfer.note ? <p>{t("manage.reference", { note: acc.bankTransfer.note })}</p> : null}
                </div>
              ) : null}
              {pay.status === "none" && pay.method === "paypal" && acc?.paypal.paypalMe ? (
                <a href={`https://paypal.me/${acc.paypal.paypalMe}/${(pay.amountCents / 100).toFixed(2)}EUR`} target="_blank" rel="noopener noreferrer" className="inline-flex font-medium text-accent hover:text-accent-hover">{t("manage.payWithPaypal", { amount: euros(pay.amountCents) })}</a>
              ) : null}
              {pay.status === "none" && pay.method === "on_site" ? <p className="text-muted">{t("manage.toPayOnSite", { amount: euros(pay.amountCents) })}</p> : null}
              {acc?.qrCode.enabled && acc.qrCode.imageUrl && pay.status !== "paid" ? (
                <div className="flex items-center gap-3 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={acc.qrCode.imageUrl} alt={t("manage.qrAlt")} className="size-24 rounded-lg border border-border bg-white object-contain" />
                  {acc.qrCode.note ? <p className="text-muted">{acc.qrCode.note}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {quote && quote.feeCents > 0 ? (
            <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">
              {quote.paid ? t("manage.feeWarningRefund", { fee: euros(quote.feeCents), refund: euros(quote.totalCents - quote.feeCents) }) : t("manage.feeWarningCard", { fee: euros(quote.feeCents) })}
            </p>
          ) : null}

          {a.status !== "cancelled" && !past ? (
            <div className="mt-6 space-y-3">
              <AddToCalendar token={token} title={`${a.serviceName ?? t("manage.appointment")} — ${b.name}`} start={a.startsAt} end={a.endsAt} location={address || null} details={memberName ? t("common.with", { name: memberName }) : null} labels={{ add: t("manage.addToCalendar"), google: t("manage.googleCalendar"), apple: t("manage.appleCalendar"), other: t("manage.otherCalendar") }} />
              {canMove ? <RescheduleWidget token={token} today={today} defaultOpen={sp.deplacer === "1"} /> : null}
              <CancelButton token={token} />
            </div>
          ) : null}

          {past && a.status === "confirmed" ? (
            <ButtonLink href={`/${b.slug}#avis`} variant="secondary" className="mt-6 w-full" icon={<Star className="size-4" aria-hidden="true" />}>
              {t("manage.leaveReview", { name: b.name })}
            </ButtonLink>
          ) : null}

          {!session && a.contactEmail ? (
            <div className="mt-6 rounded-lg border border-accent/30 bg-accent-soft p-4 text-sm">
              <p className="font-medium text-accent-soft-foreground">{t("manage.accountTitle")}</p>
              <p className="mt-1 text-muted">{t("manage.accountText")}</p>
              <ButtonLink href={`/inscription?client=1&email=${encodeURIComponent(a.contactEmail)}&nom=${encodeURIComponent(a.contactName ?? "")}&suite=${encodeURIComponent("/espace-client")}`} size="sm" className="mt-3">
                {t("manage.createAccount")}
              </ButtonLink>
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-muted">
            {t("manage.keepLink")}
            {b.phone ? <> {t("manage.question")} <a href={`tel:${b.phone}`} className="font-medium text-accent hover:text-accent-hover">{b.phone}</a></> : null}
          </p>
        </div>
        <p className="mt-6 text-center">
          <Link href={`/${b.slug}`} className="text-sm font-medium text-accent hover:text-accent-hover">
            {t("manage.bookAgain", { name: b.name })}
          </Link>
        </p>
      </main>
      <footer className="mt-10 opacity-80">
        <Brand />
      </footer>
    </div>
    </I18nProvider>
  );
}
