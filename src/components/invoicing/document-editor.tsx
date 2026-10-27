"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { addDays, money, newLine, num, totals, UNITS, VAT_RATES, type DocType, type SalesLine } from "@/lib/invoicing";
import { issueDocument, saveBillingClient, saveDocument } from "@/server/actions/invoicing";
import type { CustomerOption } from "@/server/invoicing";
import { InvoiceDocument, type DocParty } from "@/components/invoicing/invoice-document";
import { A4Frame } from "@/components/invoicing/a4-frame";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";

type CatalogItem = { id: string; name: string; unit: string; price: number; vat: number; source: "catalogue" | "prestation" };
export type EditorDoc = {
  id?: string;
  docType: DocType;
  status: string;
  number: string | null;
  customerId: string | null;
  issueDate: string;
  serviceDate: string | null;
  dueDate: string | null;
  validUntil: string | null;
  notes: string;
  lines: SalesLine[];
  relatedId?: string | null;
  related?: { number: string | null; issueDate: string } | null;
  appointmentId?: string | null;
};

const clientParty = (c: CustomerOption | undefined): DocParty | null =>
  c ? { name: c.company || c.name, contact: c.company ? c.name : "", street: c.street ?? "", zip: c.postalCode ?? "", city: c.city ?? "", country: c.country ?? "", vat: c.vatNumber ?? "", email: c.email ?? "" } : null;

/** Éditeur de facture, note de crédit ou devis, avec l'aperçu A4 en direct (repris de Comptoir). */
export function DocumentEditor({ initial, customers: initialCustomers, catalog, seller, missing, clientWord }: { initial: EditorDoc; customers: CustomerOption[]; catalog: CatalogItem[]; seller: DocParty & { vatRegime: string; paymentDays: number }; missing: string[]; clientWord: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<EditorDoc>(initial);
  const [customers, setCustomers] = useState(initialCustomers);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [newClient, setNewClient] = useState(false);
  const fr = seller.vatRegime === "franchise";
  const isQuote = doc.docType === "quote";
  const isCredit = doc.docType === "credit";
  const t = useMemo(() => totals(doc.lines, fr ? "franchise" : "assujetti"), [doc.lines, fr]);
  const client = customers.find((c) => c.id === doc.customerId);
  const set = (patch: Partial<EditorDoc>) => setDoc((d) => ({ ...d, ...patch }));
  const setLine = (i: number, patch: Partial<SalesLine>) => setDoc((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const title = isQuote ? (doc.number ? `Devis ${doc.number}` : "Nouveau devis") : isCredit ? "Note de crédit" : doc.id ? "Brouillon de facture" : "Nouvelle facture";
  const back = doc.id ? `/app/factures/${doc.id}` : isQuote ? "/app/factures/devis" : "/app/factures/liste";

  const payload = () => ({ id: doc.id, docType: doc.docType, customerId: doc.customerId, issueDate: doc.issueDate, serviceDate: doc.serviceDate, dueDate: doc.dueDate, validUntil: doc.validUntil, notes: doc.notes, lines: doc.lines, relatedId: doc.relatedId ?? null, appointmentId: doc.appointmentId ?? null });

  function save(then?: "issue") {
    setError(null);
    start(async () => {
      const r = await saveDocument(payload());
      if (!r.ok) return setError(r.error);
      if (then === "issue" && r.id) {
        const i = await issueDocument(r.id);
        if (!i.ok) {
          setConfirming(false);
          set({ id: r.id });
          return setError(i.error);
        }
      }
      router.push(`/app/factures/${r.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Retour</Link>
      <PageHeader
        title={title}
        description={isQuote ? "Le devis reste modifiable tant qu'il n'est pas facturé." : isCredit ? `Annule ou corrige la facture ${doc.related?.number ?? ""}. Ajustez les lignes si l'annulation est partielle.` : "Le numéro définitif est attribué au moment de l'émission."}
        action={
          isQuote ? (
            <Button loading={pending} onClick={() => save()}>Enregistrer le devis</Button>
          ) : (
            <>
              <Button variant="secondary" disabled={pending} onClick={() => save()}>Enregistrer le brouillon</Button>
              <Button icon={<Send className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => { setError(null); setConfirming(true); }}>Émettre {isCredit ? "la note de crédit" : "la facture"}</Button>
            </>
          )
        }
      />
      {missing.length && !isQuote ? (
        <p className="mb-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          Avant d&apos;émettre, ajoutez {missing.join(", ")} dans les <Link href="/app/factures/reglages" className="font-medium underline">réglages de facturation</Link>. Ces mentions sont obligatoires sur une facture.
        </p>
      ) : null}
      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={isQuote ? "Destinataire" : "Client"} action={!isCredit ? <Button size="sm" variant="ghost" icon={<UserPlus className="size-4" aria-hidden="true" />} onClick={() => setNewClient((v) => !v)}>Nouveau {clientWord}</Button> : undefined} />
            <div className="space-y-4 p-5">
              <Field label={isQuote ? "Devis pour" : "Facturer à"} htmlFor="e-client" hint={!customers.length ? `Aucun ${clientWord} pour l'instant : créez-le avec « Nouveau ${clientWord} ».` : undefined}>
                <Select id="e-client" value={doc.customerId ?? ""} disabled={isCredit} onChange={(e) => set({ customerId: e.target.value || null })}>
                  <option value="">Choisir…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>
                  ))}
                </Select>
              </Field>
              {client && !client.street && !isCredit ? <p className="text-sm text-muted">Pas d&apos;adresse sur la fiche : ajoutez-la depuis la fiche du {clientWord} si votre client est une entreprise.</p> : null}
              {newClient ? (
                <NewClientForm
                  onCreated={(c) => {
                    setCustomers((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)));
                    set({ customerId: c.id });
                    setNewClient(false);
                  }}
                />
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Dates" />
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={isQuote ? "Date du devis" : "Date d'émission"} htmlFor="e-issue">
                  <Input id="e-issue" type="date" value={doc.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
                </Field>
                {isQuote ? (
                  <Field label="Valable jusqu'au" htmlFor="e-valid" className="sm:col-span-2">
                    <Input id="e-valid" type="date" value={doc.validUntil ?? ""} onChange={(e) => set({ validUntil: e.target.value || null })} />
                  </Field>
                ) : isCredit ? null : (
                  <>
                    <Field label="Date de prestation" htmlFor="e-service">
                      <Input id="e-service" type="date" value={doc.serviceDate ?? ""} onChange={(e) => set({ serviceDate: e.target.value || null })} />
                    </Field>
                    <Field label="Échéance" htmlFor="e-due">
                      <Input id="e-due" type="date" value={doc.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || null })} />
                    </Field>
                  </>
                )}
              </div>
              {!isCredit ? (
                <div className="flex flex-wrap gap-2" aria-label="Délais rapides">
                  {(isQuote ? [[15, "15 jours"], [30, "30 jours"], [60, "60 jours"]] : [[0, "À réception"], [15, "15 jours"], [30, "30 jours"]]).map(([n, l]) => (
                    <button key={l} type="button" onClick={() => (isQuote ? set({ validUntil: addDays(doc.issueDate, Number(n)) }) : set({ dueDate: addDays(doc.issueDate, Number(n)) }))} className="h-8 rounded-full border border-border-strong px-3 text-sm text-muted transition-colors hover:border-muted hover:text-text">
                      {l}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Prestations"
              action={
                catalog.length ? (
                  <Select
                    aria-label="Ajouter depuis le catalogue"
                    value=""
                    className="h-9 w-56"
                    onChange={(e) => {
                      const item = catalog.find((c) => `${c.source}:${c.id}` === e.target.value);
                      if (!item) return;
                      const line = { ...newLine(), desc: item.name, unit: item.unit, price: item.price, vat: item.vat };
                      setDoc((d) => ({ ...d, lines: [...d.lines.filter((l) => l.desc.trim() || num(l.price)), line] }));
                    }}
                  >
                    <option value="">Ajouter depuis le catalogue…</option>
                    {catalog.some((c) => c.source === "prestation") ? (
                      <optgroup label="Vos prestations RDV">
                        {catalog.filter((c) => c.source === "prestation").map((c) => <option key={c.id} value={`prestation:${c.id}`}>{c.name} · {money(c.price)}</option>)}
                      </optgroup>
                    ) : null}
                    {catalog.some((c) => c.source === "catalogue") ? (
                      <optgroup label="Catalogue">
                        {catalog.filter((c) => c.source === "catalogue").map((c) => <option key={c.id} value={`catalogue:${c.id}`}>{c.name} · {money(c.price)}</option>)}
                      </optgroup>
                    ) : null}
                  </Select>
                ) : undefined
              }
            />
            <div className="space-y-4 p-5">
              {doc.lines.map((l, i) => (
                <div key={l.id} className={cn("grid grid-cols-2 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_auto]", !fr && "sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_84px_auto]")}>
                  <div className="col-span-full">
                    <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`l-desc-${l.id}`}>Description</label>
                    <Textarea id={`l-desc-${l.id}`} rows={2} className="min-h-10" value={l.desc} placeholder="Ex. : Séance de kinésithérapie" onChange={(e) => setLine(i, { desc: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`l-qty-${l.id}`}>Qté</label>
                    <Input id={`l-qty-${l.id}`} type="number" step="0.25" min="0" inputMode="decimal" className="tabular-nums" value={l.qty} onChange={(e) => setLine(i, { qty: num(e.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`l-unit-${l.id}`}>Unité</label>
                    <Select id={`l-unit-${l.id}`} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })}>
                      {[...new Set([l.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`l-price-${l.id}`}>Prix unit. €{fr ? "" : " HTVA"}</label>
                    <Input id={`l-price-${l.id}`} type="number" step="0.01" inputMode="decimal" className="tabular-nums" value={l.price} onChange={(e) => setLine(i, { price: num(e.target.value) })} />
                  </div>
                  {fr ? null : (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`l-vat-${l.id}`}>TVA</label>
                      <Select id={`l-vat-${l.id}`} value={l.vat} onChange={(e) => setLine(i, { vat: Number(e.target.value) })}>
                        {VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}
                      </Select>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-2 sm:flex-col sm:items-end sm:justify-end">
                    <span className="text-sm font-medium tabular-nums sm:pb-2">{money(num(l.qty) * num(l.price))}</span>
                    <Button variant="ghost" size="sm" aria-label="Supprimer la ligne" disabled={doc.lines.length < 2} onClick={() => setDoc((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }))}><Trash2 className="size-4" aria-hidden="true" /></Button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setDoc((d) => ({ ...d, lines: [...d.lines, newLine()] }))}>Ajouter une ligne</Button>
              <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                {fr ? null : (
                  <>
                    <div className="flex justify-between"><span>Total HTVA</span><span className="tabular-nums">{money(t.ht)}</span></div>
                    {t.vatRows.map((v) => <div key={v.rate} className="flex justify-between text-muted"><span>TVA {v.rate} %</span><span className="tabular-nums">{money(v.amt)}</span></div>)}
                  </>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total{fr ? "" : " TVAC"}</span><span className="tabular-nums">{money(fr ? t.ht : t.ttc)}</span></div>
                {fr ? <p className="text-right text-xs text-muted">Franchise : pas de TVA facturée</p> : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Note sur le document" />
            <div className="p-5">
              <Field label="Note" htmlFor="e-notes" hint="Affichée sous les prestations. Les mentions légales sont ajoutées automatiquement.">
                <Textarea id="e-notes" rows={3} value={doc.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ex. : Merci pour votre confiance." />
              </Field>
            </div>
          </Card>
        </div>

        <div className="min-w-0">
          <div className="xl:sticky xl:top-6">
            <p className="mb-2 text-sm font-medium text-muted">Aperçu</p>
            <A4Frame>
              <InvoiceDocument doc={{ ...doc, number: doc.number }} seller={seller} client={clientParty(client)} />
            </A4Frame>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Émettre ${isCredit ? "la note de crédit" : "la facture"} ?`}
        confirmLabel="Émettre"
        loading={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => save("issue")}
      >
        Montant : <b>{money(fr ? t.ht : t.ttc)}</b>{client ? <> pour <b>{client.company || client.name}</b></> : null}.
        <br />
        <br />
        Une fois émise, elle reçoit son numéro définitif et ne peut plus être modifiée ni supprimée. Pour corriger une erreur, vous ferez une note de crédit.
      </ConfirmDialog>
    </>
  );
}

function NewClientForm({ onCreated }: { onCreated: (c: CustomerOption) => void }) {
  const [v, setV] = useState({ name: "", company: "", email: "", phone: "", vatNumber: "", street: "", postalCode: "", city: "", country: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const f = (k: keyof typeof v, label: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <Field label={label} htmlFor={`nc-${k}`} error={errors[k]}>
      <Input id={`nc-${k}`} value={v[k]} onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))} aria-invalid={!!errors[k] || undefined} {...extra} />
    </Field>
  );
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {f("name", "Nom et prénom", { autoComplete: "name" })}
        {f("company", "Société (facultatif)")}
        {f("email", "Email", { type: "email" })}
        {f("phone", "Téléphone", { type: "tel" })}
        {f("vatNumber", "TVA / N° d'entreprise")}
        {f("street", "Rue et numéro")}
        {f("postalCode", "Code postal")}
        {f("city", "Ville")}
      </div>
      {msg ? <p className="text-sm text-danger" role="alert">{msg}</p> : null}
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await saveBillingClient(null, v);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              setMsg(r.error);
              return;
            }
            onCreated({ id: r.id!, name: v.name, company: v.company || null, email: v.email || null, phone: v.phone || null, vatNumber: v.vatNumber || null, street: v.street || null, postalCode: v.postalCode || null, city: v.city || null, country: v.country || null });
          })
        }
      >
        Ajouter
      </Button>
    </div>
  );
}
