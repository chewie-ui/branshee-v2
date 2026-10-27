import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarPlus, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { z } from "zod";
import { db } from "@/db";
import { appointmentPayments, appointments, customerNotes, customers, members, users } from "@/db/schema";
import { StatusBadge } from "@/components/app/status-badge";
import { DossierNotes, type NoteView } from "@/components/customers/dossier";
import { AltContactsForm, ContactForm, CustomerActions, GeneralNotes, ReassignButton } from "@/components/customers/panels";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { decrypt } from "@/lib/field-crypto";
import { clientWord } from "@/lib/terminology";
import { formatDay, formatPrice, formatTime, zoned } from "@/lib/time";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";
import { CustomerBillingForm } from "@/components/invoicing/customer-billing-form";

export const metadata: Metadata = { title: "Fiche" };

type SearchParams = Promise<{ onglet?: string; q?: string; prestation?: string; membre?: string; annee?: string }>;

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const ctx = await requireContext("customers.view");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const sp = await searchParams;
  const tab = sp.onglet === "rendez-vous" ? "rdv" : sp.onglet === "dossier" ? "dossier" : "apercu";
  const tz = ctx.business.timezone;
  const term = clientWord(ctx.business.businessType);
  const Terms = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  const canManage = ctx.can("customers.manage");

  const [row] = await db
    .select({ c: customers, account: users.email })
    .from(customers)
    .leftJoin(users, eq(users.id, customers.userId))
    .where(and(eq(customers.id, id.data), eq(customers.businessId, ctx.business.id)));
  if (!row) notFound();
  const customer = row.c;

  const history = await db
    .select({ a: appointments, memberName: members.displayName, pay: appointmentPayments })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(appointmentPayments, eq(appointmentPayments.appointmentId, appointments.id))
    .where(and(eq(appointments.customerId, customer.id), eq(appointments.businessId, ctx.business.id)))
    .orderBy(desc(appointments.startsAt));

  const general = safeDecrypt(customer.generalInfoEnc);

  const now = new Date();
  const confirmed = history.filter((h) => h.a.status === "confirmed" && !h.a.noShow);
  const done = confirmed.filter((h) => h.a.endsAt <= now).length;
  const cancelled = history.filter((h) => h.a.status === "cancelled").length;
  const noShows = history.filter((h) => h.a.noShow).length;
  const paid = history.reduce((s, h) => s + (h.pay && ["paid", "partial"].includes(h.pay.status) ? h.pay.amountCents : 0) + (h.pay?.keptCents ?? 0), 0);
  const next = [...history].reverse().find((h) => h.a.startsAt > now && h.a.status !== "cancelled");

  const state = (a: (typeof history)[number]["a"]) => (a.noShow ? <Badge tone="warning">Absent{a.noShowReason === "justified" ? " (excusé)" : ""}</Badge> : a.status === "confirmed" && a.endsAt <= now ? <Badge>Terminé</Badge> : <StatusBadge status={a.status} />);
  const Row = ({ h, reassign = false }: { h: (typeof history)[number]; reassign?: boolean }) => (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="w-28 shrink-0 text-sm">
        <p className="font-medium">{formatDay(h.a.startsAt, tz, "d MMM yyyy")}</p>
        <p className="text-muted tabular-nums">{formatTime(h.a.startsAt, tz)}</p>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <Link href={`/app/agenda/rdv/${h.a.id}`} className="block truncate font-medium hover:underline">{h.a.serviceName ?? "Rendez-vous"}</Link>
        <p className="truncate text-muted">
          {h.memberName ? `avec ${h.memberName}` : "—"}
          {h.pay && h.pay.method !== "none" ? ` · ${formatPrice(h.pay.amountCents)}` : ""}
          {h.a.customerMessage ? ` · « ${h.a.customerMessage.slice(0, 60)} »` : ""}
        </p>
        {reassign && canManage ? <ReassignButton appointmentId={h.a.id} customerId={customer.id} term={term} /> : null}
      </div>
      {state(h.a)}
    </li>
  );

  const tabs = [
    { key: "apercu", label: "Aperçu", href: `/app/clients/${customer.id}` },
    { key: "rdv", label: `Rendez-vous (${history.length})`, href: `/app/clients/${customer.id}?onglet=rendez-vous` },
    { key: "dossier", label: "Dossier", href: `/app/clients/${customer.id}?onglet=dossier` },
  ];

  return (
    <>
      <Link href="/app/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {Terms}
      </Link>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={customer.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {customer.fullName}
            {customer.blockedAt ? <Badge tone="danger">Bloqué</Badge> : null}
          </h1>
          <p className="text-sm text-muted">
            {history.length} rendez-vous · fiche créée le {formatDay(customer.createdAt, tz, "d MMMM yyyy")}
            {row.account ? ` · a un compte ${(await currentBrand()).name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.phone ? <ButtonLink href={`tel:${customer.phone}`} variant="secondary" icon={<Phone className="size-4" aria-hidden="true" />}>Appeler</ButtonLink> : null}
          {customer.phone ? <ButtonLink href={`sms:${customer.phone}`} variant="secondary" icon={<MessageCircle className="size-4" aria-hidden="true" />} aria-label="Envoyer un SMS">SMS</ButtonLink> : null}
          {customer.email ? <ButtonLink href={`mailto:${customer.email}`} variant="secondary" icon={<Mail className="size-4" aria-hidden="true" />}>Email</ButtonLink> : null}
          {ctx.can("appointments.manage") ? <ButtonLink href={`/app/agenda/nouveau?client=${customer.id}`} icon={<CalendarPlus className="size-4" aria-hidden="true" />}>Nouveau RDV</ButtonLink> : null}
        </div>
      </div>

      <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1" aria-label="Onglets de la fiche" data-tour="customer-tabs">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? "page" : undefined} className={cn("-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap", tab === t.key ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {!general.ok ? (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          Une partie du dossier est illisible : la clé de chiffrement (DATA_ENCRYPTION_KEY) est absente ou différente de celle utilisée à l&apos;enregistrement.
        </p>
      ) : null}

      {tab === "apercu" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
              {[["Terminés", done], ["Annulés", cancelled], ["Absences", noShows], ["Encaissé", formatPrice(paid)]].map(([l, v]) => (
                <div key={l} className="p-4">
                  <p className="text-sm text-muted">{l}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </Card>
            {next ? (
              <Card className="flex flex-wrap items-center gap-3 p-5">
                <CalendarDays className="size-5 text-accent" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">Prochain rendez-vous : </span>
                  <span className="first-letter:uppercase">{formatDay(next.a.startsAt, tz, "EEEE d MMMM")}</span> à {formatTime(next.a.startsAt, tz)} · {next.a.serviceName ?? "Rendez-vous"}
                </p>
                <Link href={`/app/agenda/rdv/${next.a.id}`} className="text-sm font-medium text-accent hover:text-accent-hover">Ouvrir</Link>
              </Card>
            ) : null}
            <GeneralNotes customerId={customer.id} initial={general.text} canManage={canManage} />
            <Card>
              <CardHeader title="Derniers rendez-vous" action={history.length > 5 ? <Link href={`/app/clients/${customer.id}?onglet=rendez-vous`} className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link> : null} />
              {history.length ? <ul className="divide-y divide-border">{history.slice(0, 5).map((h) => <Row key={h.a.id} h={h} />)}</ul> : <EmptyState icon={<CalendarDays />} title="Aucun rendez-vous" description={`Les rendez-vous de ce ${term} s'afficheront ici.`} />}
            </Card>
          </div>
          <div className="min-w-0 space-y-6">
            {canManage ? (
              <>
                <ContactForm customerId={customer.id} hasAccount={!!customer.userId} c={{ firstName: customer.firstName ?? (customer.lastName ? "" : customer.fullName), lastName: customer.lastName ?? "", email: customer.email ?? "", phone: customer.phone ?? "" }} />
                <AltContactsForm customerId={customer.id} c={{ altName: customer.altName ?? "", altEmail: customer.altEmail ?? "", altPhone: customer.altPhone ?? "" }} />
                {(await currentBrand()).id === "skydev" && ctx.can("invoices.manage") ? <CustomerBillingForm customerId={customer.id} initial={{ company: customer.companyName ?? "", vatNumber: customer.vatNumber ?? "", street: customer.street ?? "", postalCode: customer.postalCode ?? "", city: customer.city ?? "", country: customer.country ?? "" }} /> : null}
                <CustomerActions customerId={customer.id} name={customer.fullName} blocked={!!customer.blockedAt} blockedReason={customer.blockedReason ?? ""} term={term} />
              </>
            ) : (
              <Card>
                <CardHeader title="Coordonnées" />
                <ul className="space-y-2 p-5 text-sm">
                  <li>{customer.email ?? "Pas d'email"}</li>
                  <li>{customer.phone ?? "Pas de téléphone"}</li>
                  {customer.altName || customer.altEmail || customer.altPhone ? <li className="text-muted">Autres : {[customer.altName, customer.altEmail, customer.altPhone].filter(Boolean).join(" · ")}</li> : null}
                </ul>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {tab === "rdv" ? <AppointmentsTab history={history} sp={sp} customerId={customer.id} tz={tz} Row={Row} /> : null}

      {tab === "dossier" ? <DossierTab customerId={customer.id} canManage={canManage} tz={tz} term={term} /> : null}
    </>
  );
}

/** Déchiffrement côté serveur ; si la clé manque, on l'indique au lieu de planter la page. */
function safeDecrypt(v: string | null): { text: string; ok: boolean } {
  try {
    return { text: decrypt(v) ?? "", ok: true };
  } catch {
    return { text: "", ok: false };
  }
}

async function DossierTab({ customerId, canManage, tz, term }: { customerId: string; canManage: boolean; tz: string; term: string }) {
  const rows = await db
    .select({ n: customerNotes, author: members.displayName })
    .from(customerNotes)
    .leftJoin(members, eq(members.id, customerNotes.authorMemberId))
    .where(eq(customerNotes.customerId, customerId))
    .orderBy(desc(customerNotes.date), desc(customerNotes.createdAt));
  const decoded = rows.map(({ n }) => ({ note: safeDecrypt(n.noteEnc), todo: safeDecrypt(n.todoEnc) }));
  const unreadable = decoded.some((d) => !d.note.ok || !d.todo.ok);
  const notes: NoteView[] = rows.map(({ n, author }, i) => ({
    id: n.id,
    date: n.date,
    dateLabel: formatDay(new Date(n.date + "T12:00:00Z"), tz, "d MMMM yyyy"),
    title: n.title ?? "",
    note: decoded[i]!.note.text,
    todo: decoded[i]!.todo.text,
    author,
    file: n.attachmentPath ? { name: n.attachmentName ?? "document.pdf", size: n.attachmentSize } : null,
  }));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {unreadable ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">Certaines notes sont illisibles : la clé de chiffrement (DATA_ENCRYPTION_KEY) est absente ou différente de celle utilisée à l&apos;enregistrement.</p> : null}
      <DossierNotes customerId={customerId} notes={notes} canManage={canManage} today={format(zoned(new Date(), tz), "yyyy-MM-dd")} term={term} />
    </div>
  );
}

type HistoryRow = { a: typeof appointments.$inferSelect; memberName: string | null; pay: typeof appointmentPayments.$inferSelect | null };

async function AppointmentsTab({ history, sp, customerId, tz, Row }: { history: HistoryRow[]; sp: { q?: string; prestation?: string; membre?: string; annee?: string }; customerId: string; tz: string; Row: (p: { h: HistoryRow; reassign?: boolean }) => React.ReactNode }) {
  const q = (sp.q ?? "").trim().toLowerCase();
  const services = [...new Set(history.map((h) => h.a.serviceName).filter((s): s is string => !!s))].sort();
  const team = await db.selectDistinct({ id: members.id, name: members.displayName }).from(members).innerJoin(appointments, eq(appointments.memberId, members.id)).where(eq(appointments.customerId, customerId)).orderBy(asc(members.displayName));
  const years = [...new Set(history.map((h) => formatDay(h.a.startsAt, tz, "yyyy")))];
  const shown = history.filter(
    (h) =>
      (!q || `${h.a.serviceName ?? ""} ${h.memberName ?? ""} ${h.a.customerMessage ?? ""} ${h.a.internalNote ?? ""} ${formatDay(h.a.startsAt, tz, "d MMMM yyyy")}`.toLowerCase().includes(q)) &&
      (!sp.prestation || h.a.serviceName === sp.prestation) &&
      (!sp.membre || h.a.memberId === sp.membre) &&
      (!sp.annee || formatDay(h.a.startsAt, tz, "yyyy") === sp.annee),
  );
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" role="search">
        <input type="hidden" name="onglet" value="rendez-vous" />
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input name="q" defaultValue={sp.q} placeholder="Rechercher un rendez-vous…" className="pl-9" aria-label="Rechercher un rendez-vous" />
        </div>
        {years.length > 1 ? (
          <Select name="annee" defaultValue={sp.annee ?? ""} className="w-auto" aria-label="Année">
            <option value="">Toutes les années</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        ) : null}
        {services.length > 1 ? (
          <Select name="prestation" defaultValue={sp.prestation ?? ""} className="w-auto" aria-label="Prestation">
            <option value="">Toutes les prestations</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        ) : null}
        {team.length > 1 ? (
          <Select name="membre" defaultValue={sp.membre ?? ""} className="w-auto" aria-label="Praticien">
            <option value="">Tous les praticiens</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        ) : null}
        <button type="submit" className="h-10 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">Filtrer</button>
      </form>
      <Card>
        {shown.length ? <ul className="divide-y divide-border">{shown.map((h) => <Row key={h.a.id} h={h} reassign />)}</ul> : <p className="p-6 text-center text-sm text-muted">Aucun rendez-vous ne correspond.</p>}
      </Card>
    </div>
  );
}
