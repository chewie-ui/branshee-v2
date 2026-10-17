import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Mail, MessageSquare, Phone, UserRound } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { z } from "zod";
import { db } from "@/db";
import { appointmentPayments, appointments, members } from "@/db/schema";
import { CancelAppointmentButton, InternalNote, NoShowControl } from "@/components/app/appointment-actions";
import { RequestActions } from "@/components/app/request-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDay, formatPrice, formatTime, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Rendez-vous" };

const PAY_METHOD: Record<string, string> = { online: "En ligne", on_site: "Sur place", bank_transfer: "Virement", paypal: "PayPal", cash: "Espèces", none: "—" };
const PAY_STATUS: Record<string, string> = { none: "—", authorized: "Autorisé", paid: "Payé", refunded: "Remboursé", partial: "Partiel", penalty: "Pénalité", failed: "Échec" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("appointments.view");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [row] = await db
    .select({ a: appointments, memberName: members.displayName, pay: appointmentPayments })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(appointmentPayments, eq(appointmentPayments.appointmentId, appointments.id))
    .where(and(eq(appointments.id, id.data), eq(appointments.businessId, ctx.business.id)));
  if (!row) notFound();
  const { a, memberName, pay } = row;
  const tz = ctx.business.timezone;
  const past = a.endsAt <= new Date();
  const isBlock = a.kind === "block";
  const week = format(zoned(a.startsAt, tz), "yyyy-MM-dd");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/app/agenda?semaine=${week}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Agenda
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{isBlock ? (a.internalNote || "Créneau bloqué") : (a.contactName ?? "Rendez-vous")}</h1>
          {isBlock ? <Badge>Bloqué</Badge> : <StatusBadge status={a.status} />}
          {a.overbooked ? <Badge tone="warning">Surréservation</Badge> : null}
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {formatDay(a.startsAt, tz, "EEEE d MMMM yyyy").replace(/^./, (c) => c.toUpperCase())}, {formatTime(a.startsAt, tz)}–{formatTime(a.endsAt, tz)}
        </p>
      </div>

      <div className="space-y-6">
        {a.status === "pending" && ctx.can("appointments.manage") ? (
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">Cette demande attend votre réponse.</p>
            <RequestActions id={a.id} />
          </Card>
        ) : null}

        {!isBlock ? (
          <Card>
            <CardHeader title="Détails" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-muted">Prestation</dt><dd className="font-medium">{a.serviceName ?? "—"}</dd></div>
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-muted">Avec</dt><dd>{memberName ?? "—"}</dd></div>
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-muted">Client</dt>
                <dd className="space-y-1">
                  {a.customerId && ctx.can("customers.view") ? <Link href={`/app/clients/${a.customerId}`} className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-hover"><UserRound className="size-4" aria-hidden="true" />{a.contactName}</Link> : <p>{a.contactName}</p>}
                  {a.contactPhone ? <a href={`tel:${a.contactPhone}`} className="flex items-center gap-1.5 text-accent hover:text-accent-hover"><Phone className="size-4" aria-hidden="true" />{a.contactPhone}</a> : null}
                  {a.contactEmail ? <a href={`mailto:${a.contactEmail}`} className="flex items-center gap-1.5 text-accent hover:text-accent-hover"><Mail className="size-4" aria-hidden="true" />{a.contactEmail}</a> : null}
                </dd>
              </div>
              {pay ? (
                <div className="flex gap-3"><dt className="w-28 shrink-0 text-muted">Paiement</dt><dd>{formatPrice(pay.amountCents)} · {PAY_METHOD[pay.method]} · {PAY_STATUS[pay.status]}</dd></div>
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
        ) : null}

        {ctx.can("appointments.manage") ? (
          <Card className="space-y-5 p-5">
            {!isBlock && past && a.status === "confirmed" ? <NoShowControl id={a.id} noShow={a.noShow} reason={a.noShowReason} /> : null}
            <InternalNote id={a.id} initial={isBlock ? "" : (a.internalNote ?? "")} />
          </Card>
        ) : null}

        {a.status !== "cancelled" && !past && ctx.can("appointments.cancel") ? <CancelAppointmentButton id={a.id} isBlock={isBlock} /> : null}
      </div>
    </div>
  );
}
