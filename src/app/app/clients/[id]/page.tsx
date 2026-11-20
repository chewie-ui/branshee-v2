import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarPlus, Download, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { appointmentPayments, appointments, clientShares, customerNotes, customers, members, users } from "@/db/schema";
import { SharesPanel } from "@/components/customers/shares-panel";
import { PatientIdentityForm } from "@/components/physio/patient-identity";
import { EpisodesList } from "@/components/physio/episodes";
import { CareTeam } from "@/components/physio/care-team";
import { CareDocuments } from "@/components/physio/care-documents";
import { careDocLabel } from "@/lib/care-team";
import { careTeamOf, documentContent, documentVersions, latestDocuments } from "@/server/care-documents";
import { isPatientProfession } from "@/lib/terminology";
import { PATHOLOGY_KINDS, currentEntries, episodesOf, episodesSessionCounts, logRecordAccess } from "@/server/physio";
import type { AppContext } from "@/server/context";
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
import { normalizeMsisdn } from "@/server/sms";
import { currentBrand } from "@/server/brand";
import { CustomerBillingForm } from "@/components/invoicing/customer-billing-form";
import { CustomerActivity, activityLabel } from "@/components/customers/customer-activity";
import { customerActivity } from "@/server/customer-activity";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Fiche");

type SearchParams = Promise<{ onglet?: string; q?: string; prestation?: string; membre?: string; annee?: string }>;

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const t = await appT();
  const ctx = await requireContext("customers.view");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const sp = await searchParams;
  const skydev = (await currentBrand()).id === "skydev";
  const tab = sp.onglet === "rendez-vous" ? "rdv" : sp.onglet === "dossier" ? "dossier" : sp.onglet === "partage" ? "partage" : sp.onglet === "tout" && skydev ? "tout" : "apercu";
  const tz = ctx.business.timezone;
  const term = clientWord(ctx.business.businessType);
  const Terms = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  const canManage = ctx.can("customers.manage");
  const records = { view: ctx.can("records.view"), manage: ctx.can("records.manage"), export: ctx.can("records.export") };

  const [row] = await db
    .select({ c: customers, account: users.email })
    .from(customers)
    .leftJoin(users, eq(users.id, customers.userId))
    .where(and(eq(customers.id, id.data), eq(customers.businessId, ctx.business.id)));
  if (!row) notFound();
  const customer = row.c;
  const patient = isPatientProfession(ctx.business.businessType);
  // Dossier patient : chaque ouverture est tracée (journal des accès).
  await logRecordAccess(ctx, customer.id, "view", tab === "apercu" ? "Fiche" : `Onglet ${tab}`);

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

  const state = (a: (typeof history)[number]["a"]) => (a.noShow ? <Badge tone="warning">Absent{a.noShowReason === "justified" ? " (excusé)" : ""}</Badge> : a.status === "confirmed" && a.endsAt <= now ? <Badge>{t("Terminé")}</Badge> : <StatusBadge status={a.status} />);
  const Row = ({ h, reassign = false }: { h: (typeof history)[number]; reassign?: boolean }) => (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="w-28 shrink-0 text-sm">
        <p className="font-medium">{formatDay(h.a.startsAt, tz, "d MMM yyyy", t.locale)}</p>
        <p className="text-muted tabular-nums">{formatTime(h.a.startsAt, tz)}</p>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <Link href={`/app/agenda/rdv/${h.a.id}`} className="block truncate font-medium hover:underline">{h.a.serviceName ?? t("Rendez-vous")}</Link>
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

  // Onglet des autres apps (factures, projets, ventes…) : nommé d'après ce qu'il contient.
  const activity = skydev ? await customerActivity(ctx, { id: customer.id, email: customer.email }) : null;
  const activityTab = activity ? activityLabel(activity) : null;
  const tabs = [
    { key: "apercu", label: t("Aperçu"), href: `/app/clients/${customer.id}` },
    { key: "rdv", label: `Rendez-vous (${history.length})`, href: `/app/clients/${customer.id}?onglet=rendez-vous` },
    { key: "dossier", label: "Dossier", href: `/app/clients/${customer.id}?onglet=dossier` },
    { key: "partage", label: t("Partagé avec le client"), href: `/app/clients/${customer.id}?onglet=partage` },
    ...(skydev && activityTab ? [{ key: "tout", label: activityTab, href: `/app/clients/${customer.id}?onglet=tout` }] : []),
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
            {history.length} rendez-vous · fiche créée le {formatDay(customer.createdAt, tz, "d MMMM yyyy", t.locale)}
            {row.account ? ` · a un compte ${(await currentBrand()).name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.phone ? <ButtonLink href={`tel:${customer.phone.replace(/[^+0-9]/g, "")}`} variant="secondary" icon={<Phone className="size-4" aria-hidden="true" />}>Appeler</ButtonLink> : null}
          {customer.phone ? <ButtonLink href={`https://wa.me/${normalizeMsisdn(customer.phone)}`} target="_blank" rel="noopener noreferrer" variant="secondary" icon={<MessageCircle className="size-4" aria-hidden="true" />} aria-label={t("Écrire sur WhatsApp")}>WhatsApp</ButtonLink> : null}
          {customer.email ? <ButtonLink href={`mailto:${customer.email}`} variant="secondary" icon={<Mail className="size-4" aria-hidden="true" />}>Email</ButtonLink> : null}
          {ctx.can("appointments.manage") ? <ButtonLink href={`/app/agenda/nouveau?client=${customer.id}`} icon={<CalendarPlus className="size-4" aria-hidden="true" />}>{t("Nouveau RDV")}</ButtonLink> : null}
        </div>
      </div>

      <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-1" aria-label={t("Onglets de la fiche")} data-tour="customer-tabs">
        {tabs.map((tb) => (
          <Link key={tb.key} href={tb.href} aria-current={tab === tb.key ? "page" : undefined} className={cn("-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap", tab === tb.key ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}>
            {t(tb.label)}
          </Link>
        ))}
      </nav>

      {!general.ok ? (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {t("Une partie du dossier est illisible : la clé de chiffrement (DATA_ENCRYPTION_KEY) est absente ou différente de celle utilisée à l'enregistrement.")}
        </p>
      ) : null}

      {patient && records.view && (tab === "apercu" || tab === "dossier") ? <Synthesis ctx={ctx} customerId={customer.id} archived={!!customer.archivedAt} narrow={tab === "dossier"} /> : null}

      {activity && tab === "tout" ? <CustomerActivity a={activity} customerId={customer.id} /> : null}

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
                  <span className="font-medium">{t("Prochain rendez-vous :")} </span>
                  <span className="first-letter:uppercase">{formatDay(next.a.startsAt, tz, "EEEE d MMMM", t.locale)}</span> à {formatTime(next.a.startsAt, tz)} · {next.a.serviceName ?? t("Rendez-vous")}
                </p>
                <Link href={`/app/agenda/rdv/${next.a.id}`} className="text-sm font-medium text-accent hover:text-accent-hover">{t("Ouvrir")}</Link>
              </Card>
            ) : null}
            {patient ? (
              <PatientIdentityForm
                customerId={customer.id}
                canManage={canManage}
                initial={{ niss: safeDecrypt(customer.nissEnc).text, birthDate: customer.birthDate ?? "", sex: customer.sex ?? "", mutuality: customer.mutuality ?? "", mutualityNumber: customer.mutualityNumber ?? "", prescriberName: customer.prescriberName ?? "", prescriberInami: customer.prescriberInami ?? "", gpName: customer.gpName ?? "", gpInami: customer.gpInami ?? "", ct1: customer.ct1 ?? "", ct2: customer.ct2 ?? "", language: customer.language ?? "", archived: !!customer.archivedAt }}
              />
            ) : null}
            {patient ? <CareTeamCard ctx={ctx} customerId={customer.id} canManage={canManage} /> : null}
            <GeneralNotes customerId={customer.id} initial={t(general.text)} canManage={canManage} />
            <Card>
              <CardHeader title={t("Derniers rendez-vous")} action={history.length > 5 ? <Link href={`/app/clients/${customer.id}?onglet=rendez-vous`} className="text-sm font-medium text-accent hover:text-accent-hover">{t("Tout voir")}</Link> : null} />
              {history.length ? <ul className="divide-y divide-border">{history.slice(0, 5).map((h) => <Row key={h.a.id} h={h} />)}</ul> : <EmptyState icon={<CalendarDays />} title={t("Aucun rendez-vous")} description={`Les rendez-vous de ce ${term} s'afficheront ici.`} />}
            </Card>
          </div>
          <div className="min-w-0 space-y-6">
            {canManage ? (
              <>
                <ContactForm customerId={customer.id} term={term} hasAccount={!!customer.userId} c={{ firstName: customer.firstName ?? (customer.lastName ? "" : customer.fullName), lastName: customer.lastName ?? "", email: customer.email ?? "", phone: customer.phone ?? "" }} />
                <AltContactsForm customerId={customer.id} c={{ altName: customer.altName ?? "", altEmail: customer.altEmail ?? "", altPhone: customer.altPhone ?? "" }} />
                {(await currentBrand()).id === "skydev" && ctx.can("invoices.manage") ? <CustomerBillingForm customerId={customer.id} initial={{ company: customer.companyName ?? "", vatNumber: customer.vatNumber ?? "", street: customer.street ?? "", postalCode: customer.postalCode ?? "", city: customer.city ?? "", country: customer.country ?? "" }} /> : null}
                <CustomerActions customerId={customer.id} name={customer.fullName} blocked={!!customer.blockedAt} blockedReason={customer.blockedReason ?? ""} term={term} />
                {records.export ? <ButtonLink href={`/app/clients/${customer.id}/export`} prefetch={false} variant="secondary" className="w-full" icon={<Download className="size-4" aria-hidden="true" />}>{t("Exporter le dossier complet (JSON)")}</ButtonLink> : null}
              </>
            ) : (
              <Card>
                <CardHeader title={t("Coordonnées")} />
                <ul className="space-y-2 p-5 text-sm">
                  <li>{customer.email ?? t("Pas d'email")}</li>
                  <li>{customer.phone ?? t("Pas de téléphone")}</li>
                  {customer.altName || customer.altEmail || customer.altPhone ? <li className="text-muted">Autres : {[customer.altName, customer.altEmail, customer.altPhone].filter(Boolean).join(" · ")}</li> : null}
                </ul>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {tab === "rdv" ? <AppointmentsTab history={history} sp={sp} customerId={customer.id} tz={tz} Row={Row} /> : null}

      {tab === "dossier" && patient && records.view ? <EpisodesTab customer={customer} businessId={ctx.business.id} canManage={records.manage} /> : null}
      {tab === "dossier" && patient && records.view ? <DocumentsTab ctx={ctx} customerId={customer.id} canManage={records.manage} canExport={records.export} /> : null}

      {tab === "dossier" ? <DossierTab customerId={customer.id} canManage={canManage} tz={tz} term={term} /> : null}

      {tab === "partage" ? <SharesTab customerId={customer.id} canManage={canManage} tz={tz} hasAccount={!!customer.userId} email={customer.email} /> : null}
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
  const t = await appT();
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
    dateLabel: formatDay(new Date(n.date + "T12:00:00Z"), tz, "d MMMM yyyy", t.locale),
    title: n.title ?? "",
    note: decoded[i]!.note.text,
    todo: decoded[i]!.todo.text,
    author,
    file: n.attachmentPath ? { name: n.attachmentName ?? "document.pdf", size: n.attachmentSize } : null,
  }));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {unreadable ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{t("Certaines notes sont illisibles : la clé de chiffrement (DATA_ENCRYPTION_KEY) est absente ou différente de celle utilisée à l'enregistrement.")}</p> : null}
      <DossierNotes customerId={customerId} notes={notes} canManage={canManage} today={format(zoned(new Date(), tz), "yyyy-MM-dd")} term={term} />
    </div>
  );
}

type HistoryRow = { a: typeof appointments.$inferSelect; memberName: string | null; pay: typeof appointmentPayments.$inferSelect | null };

async function AppointmentsTab({ history, sp, customerId, tz, Row }: { history: HistoryRow[]; sp: { q?: string; prestation?: string; membre?: string; annee?: string }; customerId: string; tz: string; Row: (p: { h: HistoryRow; reassign?: boolean }) => React.ReactNode }) {
  const t = await appT();
  const q = (sp.q ?? "").trim().toLowerCase();
  const services = [...new Set(history.map((h) => h.a.serviceName).filter((s): s is string => !!s))].sort();
  const team = await db.selectDistinct({ id: members.id, name: members.displayName }).from(members).innerJoin(appointments, eq(appointments.memberId, members.id)).where(eq(appointments.customerId, customerId)).orderBy(asc(members.displayName));
  const years = [...new Set(history.map((h) => formatDay(h.a.startsAt, tz, "yyyy", t.locale)))];
  const shown = history.filter(
    (h) =>
      (!q || `${h.a.serviceName ?? ""} ${h.memberName ?? ""} ${h.a.customerMessage ?? ""} ${h.a.internalNote ?? ""} ${formatDay(h.a.startsAt, tz, "d MMMM yyyy", t.locale)}`.toLowerCase().includes(q)) &&
      (!sp.prestation || h.a.serviceName === sp.prestation) &&
      (!sp.membre || h.a.memberId === sp.membre) &&
      (!sp.annee || formatDay(h.a.startsAt, tz, "yyyy", t.locale) === sp.annee),
  );
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" role="search">
        <input type="hidden" name="onglet" value="rendez-vous" />
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input name="q" defaultValue={sp.q} placeholder={t("Rechercher un rendez-vous…")} className="pl-9" aria-label={t("Rechercher un rendez-vous")} />
        </div>
        {years.length > 1 ? (
          <Select name="annee" defaultValue={sp.annee ?? ""} className="w-auto" aria-label="Année">
            <option value="">{t("Toutes les années")}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        ) : null}
        {services.length > 1 ? (
          <Select name="prestation" defaultValue={sp.prestation ?? ""} className="w-auto" aria-label="Prestation">
            <option value="">{t("Toutes les prestations")}</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        ) : null}
        {team.length > 1 ? (
          <Select name="membre" defaultValue={sp.membre ?? ""} className="w-auto" aria-label="Praticien">
            <option value="">{t("Tous les praticiens")}</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        ) : null}
        <button type="submit" className="h-10 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">Filtrer</button>
      </form>
      <Card>
        {shown.length ? <ul className="divide-y divide-border">{shown.map((h) => <Row key={h.a.id} h={h} reassign />)}</ul> : <p className="p-6 text-center text-sm text-muted">{t("Aucun rendez-vous ne correspond.")}</p>}
      </Card>
    </div>
  );
}

/** Notes et fichiers partagés avec le client (visibles dans son espace client). */
async function SharesTab({ customerId, canManage, tz, hasAccount, email }: { customerId: string; canManage: boolean; tz: string; hasAccount: boolean; email: string | null }) {
  const rows = await db.select().from(clientShares).where(eq(clientShares.customerId, customerId)).orderBy(desc(clientShares.createdAt));
  const items = rows.map((s) => ({
    id: s.id,
    kind: s.kind === "file" ? ("file" as const) : ("note" as const),
    title: s.title,
    body: s.kind === "note" ? safeDecrypt(s.bodyEnc).text : null,
    fileName: s.fileName,
    size: s.sizeBytes,
    author: s.authorName,
    when: `${formatDay(s.createdAt, tz, "d MMM yyyy")} · ${format(zoned(s.createdAt, tz), "HH:mm")}`,
    seen: !!s.seenAt,
  }));
  return <SharesPanel customerId={customerId} items={items} canManage={canManage} hasAccount={hasAccount} email={email} />;
}

/** Épisodes de soins (prescriptions) du patient, avec compteur de séances. */
async function EpisodesTab({ customer, businessId, canManage }: { customer: typeof customers.$inferSelect; businessId: string; canManage: boolean }) {
  const eps = await episodesOf(businessId, customer.id);
  const counts = await episodesSessionCounts(eps);
  const rows = eps.map((e) => ({ id: e.id, title: e.title, kind: e.pathologyKind, kindLabel: PATHOLOGY_KINDS.find((k) => k.key === e.pathologyKind)?.label ?? e.pathologyKind, prescriptionDate: e.prescriptionDate, prescriber: e.prescriberName, done: counts[e.id] ?? 0, prescribed: e.sessionsPrescribed, status: e.status, approvalEnd: e.approvalEnd }));
  return (
    <div className="mx-auto mb-4 max-w-3xl">
      <EpisodesList customerId={customer.id} rows={rows} canManage={canManage} defaults={{ title: "", prescriberName: customer.prescriberName ?? "", prescriberInami: customer.prescriberInami ?? "", prescriptionDate: "", sessionsPrescribed: "", pathologyKind: "courante", nomenclature: "567011", inamiPlace: "I.a)", approvalStart: "", approvalEnd: "" }} />
    </div>
  );
}

/** Synthèse à l'ouverture du dossier : épisodes en cours, compteur de séances, accord / notification, dernière évaluation. */
async function Synthesis({ ctx, customerId, archived, narrow }: { ctx: AppContext; customerId: string; archived: boolean; narrow: boolean }) {
  const eps = (await episodesOf(ctx.business.id, customerId)).filter((e) => e.status === "open");
  if (!eps.length && !archived) return null;
  const counts = await episodesSessionCounts(eps);
  const lastEval = Object.fromEntries(await Promise.all(eps.map(async (e) => [e.id, (await currentEntries(e.id, ctx.user.id)).filter((x) => x.section === "evaluation" && !x.passive).at(-1)?.content ?? null] as const)));
  const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
  return (
    <Card className={cn("mb-6 divide-y divide-border", narrow && "mx-auto max-w-3xl")} aria-label="Synthèse du dossier">
      {archived ? <p className="px-5 py-3 text-sm font-medium text-warning">Dossier archivé (inactif) : consultable, réactivable depuis l&apos;identité du patient.</p> : null}
      {eps.map((e) => {
        const done = counts[e.id] ?? 0;
        const over = e.sessionsPrescribed != null && done > e.sessionsPrescribed;
        const special = e.pathologyKind !== "courante";
        return (
          <Link key={e.id} href={`/app/clients/${customerId}/episodes/${e.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-sm hover:bg-surface-muted">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{e.title}</span>
              <span className="block truncate text-muted">{PATHOLOGY_KINDS.find((k) => k.key === e.pathologyKind)?.label ?? e.pathologyKind}{lastEval[e.id] ? ` · dernière évaluation : ${lastEval[e.id]!.slice(0, 90)}` : ""}</span>
            </span>
            {special ? <span className="text-muted">{e.pathologyKind === "E" ? "Accord" : "Notification"} : <span className="font-medium text-text">{day(e.approvalStart)} → {day(e.approvalEnd)}</span></span> : null}
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${over ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-soft-foreground"}`}>{done}{e.sessionsPrescribed != null ? ` / ${e.sessionsPrescribed}` : ""} séance{done > 1 ? "s" : ""}</span>
          </Link>
        );
      })}
    </Card>
  );
}

async function CareTeamCard({ ctx, customerId, canManage }: { ctx: AppContext; customerId: string; canManage: boolean }) {
  const rows = await careTeamOf(ctx.business.id, customerId);
  return <CareTeam customerId={customerId} canManage={canManage} members={rows.map((m) => ({ id: m.id, role: m.role, name: m.name, profession: m.profession ?? "", inami: m.inami ?? "", enterpriseNumber: m.enterpriseNumber ?? "", address: m.address ?? "", phone: m.phone ?? "", email: m.email ?? "", iban: m.iban ?? "" }))} />;
}

async function DocumentsTab({ ctx, customerId, canManage, canExport }: { ctx: AppContext; customerId: string; canManage: boolean; canExport: boolean }) {
  const tz = ctx.business.timezone;
  const [docs, eps, [me]] = await Promise.all([latestDocuments(ctx.business.id, customerId), episodesOf(ctx.business.id, customerId), db.select({ inami: members.inami }).from(members).where(eq(members.id, ctx.member.id))]);
  const stamp = (d: Date) => `${formatDay(d, tz, "d MMM yyyy")} ${format(zoned(d, tz), "HH:mm")}`;
  const views = await Promise.all(
    docs.map(async (d) => ({
      key: d.docKey, kind: d.kind, kindLabel: careDocLabel(d.kind), title: d.title, recipientName: d.recipientName ?? "", recipientInami: d.recipientInami ?? "", content: documentContent(d), status: d.status, version: d.version, author: d.authorName, at: stamp(d.validatedAt ?? d.updatedAt),
      episode: eps.find((e) => e.id === d.episodeId)?.title ?? null,
      versions: d.versions > 1 ? (await documentVersions(ctx.business.id, d.docKey)).map((v) => ({ version: v.version, status: v.status, author: v.authorName, at: stamp(v.validatedAt ?? v.updatedAt) })) : [],
    })),
  );
  return (
    <div className="mx-auto mb-4 max-w-3xl">
      <CareDocuments customerId={customerId} docs={views} episodes={eps.map((e) => ({ id: e.id, title: e.title }))} canManage={canManage} canExport={canExport} myInami={me?.inami ?? ""} />
    </div>
  );
}
