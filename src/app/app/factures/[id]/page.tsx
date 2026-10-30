import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleAlert, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { A4Frame } from "@/components/invoicing/a4-frame";
import { DocActions } from "@/components/invoicing/doc-actions";
import { StateBadge } from "@/components/invoicing/doc-list";
import { InvoiceDocument, type DocParty } from "@/components/invoicing/invoice-document";
import { daysBetween, docState, docTitle, fdate, mailText, moneyCents, todayIso } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { customerOptions, getDocument, getSellerSettings, paymentQr, relatedDocuments } from "@/server/invoicing";
import { SignPanel, type SigView } from "@/components/signature/sign-panel";
import { signOrigin, signaturesOfDoc } from "@/server/signatures";
import { ublMissing } from "@/lib/ubl";
import { InvoiceMailPanel } from "@/components/invoicing/invoice-mail-panel";
import { currentBrand } from "@/server/brand";
import { invoiceUrl, mailingOf, reminderRuleOf } from "@/server/invoice-mailing";

export const metadata: Metadata = { title: "Document" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("invoices.view");
  const d = await getDocument(ctx.business.id, (await params).id);
  if (!d) notFound();
  const today = todayIso(ctx.business.timezone);
  const [settings, customers, rel, qr] = await Promise.all([getSellerSettings(ctx.business.id), customerOptions(ctx.business.id), relatedDocuments(ctx.business.id, d), paymentQr(d)]);
  // Document émis : les copies figées font foi. Brouillon : les infos actuelles.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { saved: _saved, ...current } = settings;
  const seller: DocParty = d.seller ?? current;
  const c = customers.find((x) => x.id === d.customerId);
  const client: DocParty | null = d.client ?? (c ? { name: c.company || c.name, contact: c.company ? c.name : "", street: c.street ?? "", zip: c.postalCode ?? "", city: c.city ?? "", country: c.country ?? "", vat: c.vatNumber ?? "", email: c.email ?? "" } : null);
  const state = docState(d, today);
  const sellerName = String(seller.tradeName || seller.legalName || ctx.business.name);
  const view = { docType: d.docType, number: d.number, ttc: d.ttcCents / 100, dueDate: d.dueDate, comm: d.comm, validUntil: d.validUntil };
  const days = d.dueDate ? daysBetween(today, d.dueDate) : 0;
  const isQuote = d.docType === "quote";
  const sigs = isQuote ? await signaturesOfDoc(ctx.business.id, d.id) : [];
  // Skydev : envoi de la facture par email depuis la plateforme, avec rappels automatiques.
  const mailable = !isQuote && !!d.number && d.status !== "draft" && (await currentBrand()).id === "skydev";
  const [mailing, rule] = mailable ? await Promise.all([mailingOf(ctx.business.id, d.id), reminderRuleOf(ctx.business.id)]) : [null, null];
  const last = sigs.find((x) => x.signedAt) ?? sigs.find((x) => !x.cancelledAt) ?? null;
  const sig: SigView | null = last
    ? { status: last.signedAt ? "signed" : last.declinedAt ? "declined" : last.expiresAt < new Date() ? "expired" : last.viewedAt ? "viewed" : "pending", email: last.email, sentAt: last.sentAt.toISOString(), url: `${signOrigin()}/signer/${last.token}`, signerName: last.signerName, signedAt: last.signedAt?.toISOString() ?? null, path: last.signaturePath, ip: last.signerIp, hash: last.docHash, reason: last.declineReason }
    : null;
  const back = isQuote ? { href: "/app/factures/devis", label: "Devis" } : { href: "/app/factures/liste", label: "Factures" };

  return (
    <>
      <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />{back.label}</Link>
      <div className="mb-6 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{docTitle(d.docType)} <span className="font-medium tabular-nums text-muted">{d.number ?? "brouillon"}</span></h1>
            <StateBadge state={state} />
          </div>
          <p className="mt-1 text-sm text-muted">{String(client?.name ?? "Sans client")} · {isQuote ? "du" : d.number ? "émise le" : "daté du"} {fdate(d.issueDate)}</p>
        </div>
        <DocActions id={d.id} docType={d.docType} state={state} signed={sigs.some((x) => !!x.signedAt)} today={today} canManage={ctx.can("invoices.manage")} mail={mailText(view, sellerName, String(seller.iban ?? ""))} reminder={state === "overdue" ? mailText(view, sellerName, String(seller.iban ?? ""), true) : null} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <A4Frame>
          <InvoiceDocument doc={{ ...d, related: rel.linked }} seller={seller} client={client} qr={qr} />
        </A4Frame>
        <div className="space-y-4">
          {state === "overdue" ? (
            <p className="flex gap-2 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger" role="status"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span><b>En retard de {-days} jour{-days > 1 ? "s" : ""}.</b> Envoyez une relance polie : le texte est prêt (« Copier une relance »).</span></p>
          ) : state === "open" ? (
            <p className="flex gap-2 rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm text-accent-soft-foreground" role="status"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Échéance {days === 0 ? "aujourd'hui" : `dans ${days} jour${days > 1 ? "s" : ""}`}. Quand le virement arrive, marquez la facture comme payée.</span></p>
          ) : state === "expired" ? (
            <p className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning" role="status"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Ce devis a dépassé sa date de validité. Relancez le client ou dupliquez-le avec une nouvelle date.</span></p>
          ) : null}
          {mailable ? (
            <InvoiceMailPanel
              documentId={d.id}
              defaultEmail={String(client?.email ?? "")}
              mailing={mailing ? { email: mailing.email, sentAt: mailing.sentAt.toISOString(), viewedAt: mailing.viewedAt?.toISOString() ?? null, remindersSent: mailing.remindersSent, remindersOff: mailing.remindersOff, url: invoiceUrl(mailing.token) } : null}
              remindersOn={!!rule?.enabled}
              canManage={ctx.can("invoices.manage")}
              unpaid={d.status === "sent"}
              credit={d.docType === "credit"}
            />
          ) : null}
          {!isQuote && d.number && d.seller && d.client ? (() => {
            const missing = ublMissing({ docType: d.docType as "invoice" | "credit", number: d.number, issueDate: d.issueDate, dueDate: d.dueDate, serviceDate: d.serviceDate, comm: d.comm, notes: d.notes, lines: d.lines, seller: d.seller, client: d.client });
            return (
              <Card>
                <CardHeader title="Facture électronique (Peppol)" description="Obligatoire entre entreprises assujetties en Belgique depuis 2026." />
                <div className="space-y-2 p-5 text-sm">
                  {missing.includes("n° de TVA ou d'entreprise du client") ? <p className="text-muted">Client sans n° de TVA ni n° d&apos;entreprise : s&apos;il s&apos;agit d&apos;un particulier, pas de Peppol, le PDF suffit.</p> : missing.length ? <p className="text-warning">Il manque : {missing.join(", ")}. Complétez la fiche du client et les réglages de Factures, puis refaites une facture.</p> : <a href={`/app/factures/${d.id}/ubl`} download className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3 font-medium hover:bg-surface-muted">Télécharger le fichier UBL</a>}
                  <p className="text-xs text-muted">Fichier au format Peppol BIS 3.0, à déposer chez votre point d&apos;accès Peppol. Pour un client particulier, le PDF suffit.</p>
                </div>
              </Card>
            );
          })() : null}
          {isQuote ? <SignPanel documentId={d.id} defaultEmail={String(client?.email ?? "")} current={sig} canManage={ctx.can("invoices.manage")} editable={d.status !== "invoiced" && d.status !== "refused"} /> : null}
          <Card>
            <CardHeader title="Détails" />
            <dl className="divide-y divide-border text-sm">
              {[
                [d.docType === "credit" ? "Montant crédité" : "Montant", moneyCents(d.ttcCents)],
                d.vatCents ? ["dont TVA", moneyCents(d.vatCents)] : null,
                d.docType === "invoice" ? ["Échéance", fdate(d.dueDate)] : null,
                isQuote ? ["Valable jusqu'au", fdate(d.validUntil)] : null,
                d.paidDate ? ["Payée le", `${fdate(d.paidDate)}${d.paidMethod ? ` (${d.paidMethod.toLowerCase()})` : ""}`] : null,
                d.comm ? ["Communication", d.comm] : null,
              ]
                .filter((x): x is [string, string] => !!x)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-5 py-2.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 text-right font-medium tabular-nums [overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
              <div className="flex justify-between gap-3 px-5 py-2.5">
                <dt className="text-muted">Client</dt>
                <dd className="text-right font-medium">{d.customerId ? <Link href={`/app/clients/${d.customerId}`} className="hover:text-accent">{String(client?.name ?? "—")}</Link> : "—"}</dd>
              </div>
              {rel.linked ? (
                <div className="flex justify-between gap-3 px-5 py-2.5">
                  <dt className="text-muted">{d.docType === "credit" ? "Facture d'origine" : "Facture"}</dt>
                  <dd><Link href={`/app/factures/${d.relatedId}`} className="font-medium tabular-nums text-accent hover:text-accent-hover">{rel.linked.number ?? "brouillon"}</Link></dd>
                </div>
              ) : null}
              {rel.children.filter((x) => x.docType === "credit").map((x) => (
                <div key={x.id} className="flex justify-between gap-3 px-5 py-2.5">
                  <dt className="text-muted">Note de crédit</dt>
                  <dd><Link href={`/app/factures/${x.id}`} className="font-medium tabular-nums text-accent hover:text-accent-hover">{x.number ?? "brouillon"}</Link></dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Historique" />
            <ol className="space-y-2 p-5 text-sm">
              {[
                [d.createdAt, "Créé"],
                [d.issuedAt, "Émis"],
                [d.paidDate ? new Date(d.paidDate + "T12:00:00") : null, "Payé"],
                [d.cancelledAt, "Annulé par note de crédit"],
              ]
                .filter((x): x is [Date, string] => !!x[0])
                .map(([at, label]) => (
                  <li key={label} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />{label} le {fdate(at.toISOString().slice(0, 10))}</li>
                ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
