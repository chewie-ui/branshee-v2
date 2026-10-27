import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, Clock, Mail, MessageSquare, Phone, UserRound } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { z } from "zod";
import { db } from "@/db";
import { appointmentPayments, appointments, customers, members, services, users } from "@/db/schema";
import { CancelAppointmentButton, InternalNote, NoShowControl, PenaltyReview } from "@/components/app/appointment-actions";
import { ClientContactActions, PaymentForm, RescheduleForm, RestoreButton } from "@/components/agenda/appointment-editors";
import { RequestActions } from "@/components/app/request-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { clientWord } from "@/lib/terminology";
import { formatDay, formatPrice, formatTime, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { salesDocuments } from "@/db/schema";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Rendez-vous" };

const PAY_METHOD: Record<string, string> = { online: "En ligne", on_site: "Sur place", bank_transfer: "Virement", paypal: "PayPal", cash: "Espèces", none: "—" };
const PAY_STATUS: Record<string, string> = { none: "Non payé", authorized: "Autorisé", paid: "Payé", refunded: "Remboursé", partial: "Payé en partie", penalty: "Pénalité", failed: "Échec" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("appointments.view");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [row] = await db
    .select({ a: appointments, memberName: members.displayName, pay: appointmentPayments, account: { email: users.email, name: users.fullName }, priceCents: services.priceCents })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(appointmentPayments, eq(appointmentPayments.appointmentId, appointments.id))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(users, eq(users.id, customers.userId))
    .where(and(eq(appointments.id, id.data), eq(appointments.businessId, ctx.business.id)));
  if (!row) notFound();
  const { a, memberName, pay, account, priceCents } = row;
  const euros = (c: number) => (c / 100).toString().replace(".", ",");
  if (a.kind === "block") redirect(`/app/agenda/bloquer?id=${a.id}`);

  const tz = ctx.business.timezone;
  const now = new Date();
  const past = a.endsAt <= now;
  const week = format(zoned(a.startsAt, tz), "yyyy-MM-dd");
  const term = clientWord(ctx.business.businessType);
  const canManage = ctx.can("appointments.manage");
  const team = canManage ? await db.select({ id: members.id, name: members.displayName }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.status, "active"))).orderBy(asc(members.createdAt)) : [];
  const durationMin = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/app/agenda?semaine=${week}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Agenda
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{a.contactName ?? "Rendez-vous"}</h1>
          {past && a.status === "confirmed" ? <Badge>Terminé</Badge> : <StatusBadge status={a.status} />}
          {a.noShow ? <Badge tone="warning">Absent{a.noShowReason === "justified" ? " (excusé)" : ""}</Badge> : null}
          {a.overbooked ? <Badge tone="warning">Surréservation</Badge> : null}
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {formatDay(a.startsAt, tz, "EEEE d MMMM yyyy").replace(/^./, (c) => c.toUpperCase())}, {formatTime(a.startsAt, tz)}–{formatTime(a.endsAt, tz)}
        </p>
      </div>

      <div className="space-y-6">
        {a.status === "pending" && canManage ? (
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{a.startsAt < now ? "Cette demande a expiré : sa date est passée." : "Cette demande attend votre réponse."}</p>
            <RequestActions id={a.id} expired={a.startsAt < now} />
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Détails" />
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-muted">Prestation</dt><dd className="font-medium">{a.serviceName ?? "Aucune prestation"}</dd></div>
            <div className="flex gap-3"><dt className="w-28 shrink-0 text-muted">Avec</dt><dd>{memberName ?? "Non assigné"}</dd></div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-muted first-letter:uppercase">{term}</dt>
              <dd className="min-w-0 space-y-1">
                {a.customerId && ctx.can("customers.view") ? <Link href={`/app/clients/${a.customerId}`} className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-hover"><UserRound className="size-4" aria-hidden="true" />{a.contactName}</Link> : <p>{a.contactName}</p>}
                {a.contactPhone ? <a href={`tel:${a.contactPhone}`} className="flex items-center gap-1.5 text-accent hover:text-accent-hover"><Phone className="size-4" aria-hidden="true" />{a.contactPhone}</a> : null}
                {a.contactEmail ? <a href={`mailto:${a.contactEmail}`} className="flex items-center gap-1.5 break-all text-accent hover:text-accent-hover"><Mail className="size-4 shrink-0" aria-hidden="true" />{a.contactEmail}</a> : null}
                {account ? <p className="flex items-center gap-1.5 text-muted"><BadgeCheck className="size-4 text-success" aria-hidden="true" />Compte Branshee : {account.email}</p> : null}
              </dd>
            </div>
            {a.policyConsent ? (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-muted">Conditions</dt>
                <dd>
                  <details>
                    <summary className="cursor-pointer">Acceptées le {formatDay(new Date(a.policyConsent.acceptedAt), tz, "d MMMM yyyy")} à {formatTime(new Date(a.policyConsent.acceptedAt), tz)}</summary>
                    <p className="mt-1 whitespace-pre-line text-muted">{a.policyConsent.text}</p>
                  </details>
                </dd>
              </div>
            ) : null}
            {pay && pay.method !== "none" ? (
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-muted">Paiement</dt><dd>{formatPrice(pay.amountCents)} · {PAY_METHOD[pay.method]} · {PAY_STATUS[pay.status]}{pay.penaltyCents ? ` · frais ${formatPrice(pay.penaltyCents)}` : ""}</dd></div>
            ) : null}
          </dl>
          {a.customerMessage || a.formAnswers.length ? (
            <div className="space-y-3 border-t border-border p-5 text-sm">
              {a.customerMessage ? (
                <p className="flex gap-2"><MessageSquare className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" /><span className="whitespace-pre-line">{a.customerMessage}</span></p>
              ) : null}
              {a.formAnswers.map((f, i) => (
                <div key={i}><p className="text-muted">{f.question}</p><p className="font-medium">{f.answer}</p></div>
              ))}
            </div>
          ) : null}
        </Card>

        {canManage && a.status !== "cancelled" && !a.groupSessionId ? (
          <Card className="space-y-4 p-5">
            <RescheduleForm
              id={a.id}
              initial={{ date: week, start: formatTime(a.startsAt, tz), durationMin, memberId: a.memberId ?? "" }}
              members={team}
              hasEmail={!!a.contactEmail}
              clientTerm={term}
            />
            {a.contactEmail ? (
              <ClientContactActions
                id={a.id}
                canRemind={!past && a.status === "confirmed"}
                sentAt={a.manualReminderSentAt ? `${formatDay(a.manualReminderSentAt, tz, "d MMM")} à ${formatTime(a.manualReminderSentAt, tz)}` : null}
                clientTerm={term}
              />
            ) : null}
          </Card>
        ) : null}

        {canManage ? (
          <Card className="space-y-5 p-5">
            {past && a.status === "confirmed" ? <NoShowControl id={a.id} noShow={a.noShow} reason={a.noShowReason} /> : null}
            <InternalNote id={a.id} initial={a.internalNote ?? ""} />
          </Card>
        ) : null}

        {canManage ? (
          <Card>
            <CardHeader title="Paiement" description="À noter à la main pour un paiement sur place, un virement reçu…" />
            <div className="space-y-4 p-5">
              {pay?.stripePaymentIntentId || pay?.stripeSetupIntentId ? (
                <p className="text-sm">
                  {pay.status === "paid" ? "Payé en ligne" : pay.status === "authorized" ? "Carte enregistrée en garantie" : pay.status === "penalty" ? "Frais prélevés" : pay.status === "refunded" ? "Remboursé" : pay.status === "partial" ? "Remboursé en partie" : pay.status === "failed" ? "Prélèvement échoué" : "Paiement Stripe"}
                  {pay.cardBrand ? ` · ${pay.cardBrand.toUpperCase()} •••• ${pay.cardLast4}` : ""}
                  {pay.amountCents ? ` · ${(pay.amountCents / 100).toFixed(2).replace(".", ",")} €` : ""}
                  {pay.keptCents ? ` · ${(pay.keptCents / 100).toFixed(2).replace(".", ",")} € retenus` : ""}
                </p>
              ) : null}
              {pay?.status === "penalty" && !pay.cancellationDecision ? <PenaltyReview id={a.id} amount={`${(pay.penaltyCents / 100).toFixed(2).replace(".", ",")} €`} /> : null}
              <PaymentForm id={a.id} initial={{ method: pay?.method ?? "none", status: pay?.status ?? "none", amount: pay?.amountCents ? euros(pay.amountCents) : priceCents ? euros(priceCents) : "" }} />
            </div>
          </Card>
        ) : null}

        {/* Skydev : facturer ce rendez-vous dans l'app Factures (client, prestation, prix et date repris). */}
        {(await currentBrand()).id === "skydev" && ctx.can("invoices.manage") ? (
          await (async () => {
            const [inv] = await db.select({ id: salesDocuments.id, number: salesDocuments.number }).from(salesDocuments).where(and(eq(salesDocuments.businessId, ctx.business.id), eq(salesDocuments.appointmentId, a.id))).limit(1);
            return (
              <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Facture</p>
                  <p className="text-sm text-muted">{inv ? `Facture ${inv.number ?? "en brouillon"} liée à ce rendez-vous.` : "Créez la facture de ce rendez-vous en un clic."}</p>
                </div>
                <ButtonLink href={inv ? `/app/factures/${inv.id}` : `/app/factures/nouvelle?rdv=${a.id}`} variant="secondary">{inv ? "Voir la facture" : "Facturer ce rendez-vous"}</ButtonLink>
              </Card>
            );
          })()
        ) : null}

        {a.status === "cancelled" && canManage ? <RestoreButton id={a.id} /> : null}
        {a.status !== "cancelled" && !past && ctx.can("appointments.cancel") ? <CancelAppointmentButton id={a.id} isBlock={false} /> : null}
      </div>
    </div>
  );
}
