"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { disconnectStripe, linkStripeAccount, savePaymentSettings } from "@/server/actions/payments";
import { Section, SettingsForm, Toggle } from "./settings-form";

type P = {
  stripeConfigured: boolean;
  stripe: { status: "not_connected" | "pending" | "active"; email: string | null; accountId: string | null };
  prepaymentEnabled: boolean;
  prepaymentRequired: boolean;
  cancellationRule: "free" | "half_24h" | "full_12h";
  accepted: { cash: boolean; cardOnSite: boolean; bankTransfer: { enabled: boolean; iban?: string; bic?: string; bankName?: string; note?: string }; paypal: { enabled: boolean; paypalMe?: string }; qrCode: { enabled: boolean; imageUrl?: string; note?: string } };
  payout: { method?: string; iban?: string; bic?: string; paypalEmail?: string; other?: string };
};

const RULES = [
  { v: "free", t: "Annulation gratuite", d: "Le client peut annuler à tout moment sans frais." },
  { v: "half_24h", t: "50 % moins de 24 h avant", d: "Annulation tardive : la moitié du prix est due." },
  { v: "full_12h", t: "50 % sous 24 h, 100 % sous 12 h", d: "La politique la plus stricte." },
];

export function StripeCard({ p }: { p: P }) {
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Section title="Paiement en ligne (Stripe)" description="Recevez les paiements et les frais d'annulation directement sur votre compte bancaire, via Stripe.">
      {!p.stripeConfigured ? (
        <p className="rounded-lg bg-surface-muted p-3 text-sm text-muted">Le paiement en ligne n&apos;est pas encore activé sur ce serveur (clés Stripe manquantes).</p>
      ) : p.stripe.status === "active" ? (
        <div className="flex flex-wrap items-center gap-3">
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          <p className="flex-1 text-sm">Compte Stripe connecté{p.stripe.email ? ` (${p.stripe.email})` : ""}.</p>
          <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { await disconnectStripe(); })}>Déconnecter</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/app/reglages/paiements/stripe/connecter" prefetch={false} icon={<CreditCard className="size-4" aria-hidden="true" />}>
              {p.stripe.status === "pending" ? "Terminer l'inscription Stripe" : "Connecter Stripe"}
            </ButtonLink>
            <p className="text-sm text-muted">{p.stripe.status === "pending" ? "Inscription commencée : il reste quelques informations à donner à Stripe." : "5 minutes : identité, IBAN. Gratuit, Stripe prend une commission par paiement."}</p>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent">J&apos;ai déjà un compte Stripe relié à Branshee</summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="Identifiant du compte" htmlFor="acct">
                <Input id="acct" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="acct_…" className="w-64" />
              </Field>
              <Button variant="secondary" size="sm" loading={pending} onClick={() => start(async () => { const r = await linkStripeAccount(manual); setMsg(r.ok ? { ok: true, text: "Compte relié." } : { ok: false, text: r.error ?? "Erreur." }); })}>Relier</Button>
            </div>
          </details>
          {msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p> : null}
        </div>
      )}
    </Section>
  );
}

export function PaymentsForm({ p }: { p: P }) {
  const [prepay, setPrepay] = useState(p.prepaymentEnabled);
  const [bt, setBt] = useState(p.accepted.bankTransfer.enabled);
  const [pp, setPp] = useState(p.accepted.paypal.enabled);
  const [qr, setQr] = useState(p.accepted.qrCode.enabled);
  const [payout, setPayout] = useState(p.payout.method ?? "");
  const [removeQr, setRemoveQr] = useState(false);
  return (
    <SettingsForm action={savePaymentSettings}>
      {(err) => (
        <>
          <Section title="Prépaiement" description="Faire payer en ligne au moment de la réservation (prestations avec un prix).">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="prepaymentEnabled" checked={prepay} onChange={(e) => setPrepay(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span><span className="font-medium">Proposer le paiement en ligne</span><span className="block text-muted">Nécessite un compte Stripe connecté, ou un moyen de reversement ci-dessous.</span></span>
            </label>
            {prepay ? <Toggle name="prepaymentRequired" defaultChecked={p.prepaymentRequired} label="Obligatoire" description="Sinon, le client choisit entre payer en ligne et payer sur place." /> : null}
          </Section>

          <Section title="Politique d'annulation" description="Appliquée aux clients qui ont payé en ligne ou laissé une carte en garantie. Les frais propres à une prestation la remplacent.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
              {RULES.map((r) => (
                <label key={r.v} className="cursor-pointer rounded-lg border border-border-strong p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="radio" name="cancellationRule" value={r.v} defaultChecked={p.cancellationRule === r.v} className="sr-only" />
                  <span className="block font-medium">{r.t}</span>
                  <span className="block text-muted">{r.d}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-muted">Hors annulation gratuite, une carte est demandée en garantie aux clients qui paient sur place (rien n&apos;est prélevé à la réservation). Une absence non excusée peut être facturée depuis la fiche du rendez-vous.</p>
          </Section>

          <Section title="Modes de paiement acceptés sur place" description="Affichés au client lors de la réservation et dans le rappel.">
            <Toggle name="cash" defaultChecked={p.accepted.cash} label="Espèces" />
            <Toggle name="cardOnSite" defaultChecked={p.accepted.cardOnSite} label="Carte bancaire sur place" />
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="btEnabled" checked={bt} onChange={(e) => setBt(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span className="font-medium">Virement bancaire</span>
            </label>
            {bt ? (
              <div className="grid grid-cols-1 gap-4 pl-7 sm:grid-cols-2">
                <Field label="IBAN" htmlFor="iban" error={err.iban}><Input id="iban" name="iban" defaultValue={p.accepted.bankTransfer.iban} placeholder="BE68 5390 0754 7034" /></Field>
                <Field label="BIC" htmlFor="bic" error={err.bic}><Input id="bic" name="bic" defaultValue={p.accepted.bankTransfer.bic} /></Field>
                <Field label="Banque" htmlFor="bankName"><Input id="bankName" name="bankName" defaultValue={p.accepted.bankTransfer.bankName} /></Field>
                <Field label="Communication / note" htmlFor="bankNote"><Input id="bankNote" name="bankNote" defaultValue={p.accepted.bankTransfer.note} placeholder="Nom + date du RDV" /></Field>
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="ppEnabled" checked={pp} onChange={(e) => setPp(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span className="font-medium">PayPal</span>
            </label>
            {pp ? (
              <div className="pl-7">
                <Field label="Identifiant PayPal.me" htmlFor="paypalMe" error={err.paypalMe}>
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-border-strong sm:max-w-sm">
                    <span className="flex items-center bg-surface-muted px-3 text-sm text-muted">paypal.me/</span>
                    <input id="paypalMe" name="paypalMe" defaultValue={p.accepted.paypal.paypalMe} className="h-10 min-w-0 flex-1 bg-surface px-3 text-sm focus-visible:outline-none" />
                  </div>
                </Field>
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="qrEnabled" checked={qr} onChange={(e) => setQr(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span><span className="font-medium">QR code de paiement</span><span className="block text-muted">Payconiq, Wero… : une photo de votre QR code.</span></span>
            </label>
            {qr ? (
              <div className="grid grid-cols-1 gap-4 pl-7 sm:grid-cols-2">
                <div className="space-y-2">
                  {p.accepted.qrCode.imageUrl && !removeQr ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.accepted.qrCode.imageUrl} alt="QR code de paiement" className="size-20 rounded-lg border border-border object-contain" />
                      <button type="button" onClick={() => setRemoveQr(true)} className="text-sm text-muted hover:text-danger">Retirer</button>
                    </div>
                  ) : null}
                  {removeQr ? <input type="hidden" name="removeQr" value="1" /> : null}
                  <Field label="Image du QR code" htmlFor="qrImage" error={err.qrImage}><input id="qrImage" name="qrImage" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" /></Field>
                </div>
                <Field label="Note" htmlFor="qrNote"><Input id="qrNote" name="qrNote" defaultValue={p.accepted.qrCode.note} /></Field>
              </div>
            ) : null}
          </Section>

          {p.stripe.status !== "active" ? (
            <Section title="Reversement" description="Sans compte Stripe connecté, Branshee encaisse les paiements en ligne et vous les reverse.">
              <Field label="Moyen de reversement" htmlFor="payoutMethod">
                <Select id="payoutMethod" name="payoutMethod" value={payout} onChange={(e) => setPayout(e.target.value)} className="sm:max-w-xs">
                  <option value="">Non renseigné</option>
                  <option value="bank_transfer">Virement</option>
                  <option value="paypal">PayPal</option>
                  <option value="cash">Espèces</option>
                  <option value="other">Autre</option>
                </Select>
              </Field>
              {payout === "bank_transfer" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="IBAN" htmlFor="payoutIban"><Input id="payoutIban" name="payoutIban" defaultValue={p.payout.iban} /></Field>
                  <Field label="BIC" htmlFor="payoutBic"><Input id="payoutBic" name="payoutBic" defaultValue={p.payout.bic} /></Field>
                </div>
              ) : null}
              {payout === "paypal" ? <Field label="Email PayPal" htmlFor="payoutPaypal" error={err.paypalEmail}><Input id="payoutPaypal" name="payoutPaypal" type="email" defaultValue={p.payout.paypalEmail} className="sm:max-w-sm" /></Field> : null}
              {payout === "other" ? <Field label="Précisions" htmlFor="payoutOther"><Input id="payoutOther" name="payoutOther" defaultValue={p.payout.other} /></Field> : null}
            </Section>
          ) : (
            <input type="hidden" name="payoutMethod" value={p.payout.method ?? ""} />
          )}
        </>
      )}
    </SettingsForm>
  );
}
