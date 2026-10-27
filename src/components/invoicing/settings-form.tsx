"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { bceFmt, ibanFmt, type SellerSettings } from "@/lib/invoicing";
import { saveInvoiceSettings } from "@/server/actions/invoicing";

const COLORS = ["#4f46e5", "#0f766e", "#1d4ed8", "#9d174d", "#b45309", "#18181b"];

/** Identité de facturation : les mentions obligatoires d'une facture belge, l'IBAN et le régime TVA. */
export function InvoiceSettingsForm({ initial, saved, canManage }: { initial: SellerSettings; saved: boolean; canManage: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, bce: initial.bce ? bceFmt(initial.bce) : "", iban: initial.iban ? ibanFmt(initial.iban) : "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));
  const text = (k: keyof typeof v, label: string, extra: React.ComponentProps<typeof Input> & { hint?: string } = {}) => {
    const { hint, ...rest } = extra;
    return (
      <Field label={label} htmlFor={`s-${k}`} error={errors[k]} hint={hint}>
        <Input id={`s-${k}`} value={String(v[k] ?? "")} disabled={!canManage} onChange={(e) => set(k, e.target.value as never)} aria-invalid={!!errors[k] || undefined} {...rest} />
      </Field>
    );
  };
  const submit = () =>
    start(async () => {
      const r = await saveInvoiceSettings({ ...v, paymentDays: Number(v.paymentDays) });
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      setMsg(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-6">
      {!saved ? <p className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-soft-foreground" role="status">Complétez ces informations une fois : elles apparaissent sur toutes vos factures. On a pré-rempli ce qu&apos;on connaît déjà de votre établissement.</p> : null}
      <Card>
        <CardHeader title="Votre entreprise" description="Mentions obligatoires : nom, adresse et numéro d'entreprise (BCE)." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          {text("legalName", "Nom ou raison sociale", { hint: "Votre nom si vous êtes en personne physique.", autoComplete: "organization" })}
          {text("tradeName", "Nom commercial (facultatif)")}
          <Field label="Forme juridique" htmlFor="s-legalForm">
            <Select id="s-legalForm" value={v.legalForm} disabled={!canManage} onChange={(e) => set("legalForm", e.target.value)}>
              {["Personne physique", "SRL", "SA", "SC", "ASBL", "SNC", "SComm"].map((f) => <option key={f}>{f}</option>)}
            </Select>
          </Field>
          {text("bce", "Numéro d'entreprise (BCE)", { placeholder: "1234.567.890", inputMode: "numeric" })}
          {text("street", "Rue et numéro", { autoComplete: "street-address" })}
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
            {text("zip", "Code postal", { autoComplete: "postal-code" })}
            {text("city", "Ville", { autoComplete: "address-level2" })}
          </div>
          {text("email", "Email", { type: "email" })}
          {text("phone", "Téléphone", { type: "tel" })}
        </div>
      </Card>

      <Card>
        <CardHeader title="TVA" description="En franchise (chiffre d'affaires sous 25 000 €/an), vos factures ne mentionnent pas de TVA." />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Régime TVA">
            {([["franchise", "Franchise des petites entreprises", "Pas de TVA sur vos factures, mention légale ajoutée."], ["assujetti", "Assujetti à la TVA", "TVA par ligne (21, 12, 6 ou 0 %), totaux HTVA et TVAC."]] as const).map(([k, t, d]) => (
              <button key={k} type="button" role="radio" aria-checked={v.vatRegime === k} disabled={!canManage} onClick={() => set("vatRegime", k)} className={cn("rounded-xl border p-4 text-left transition-colors", v.vatRegime === k ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border hover:border-border-strong")}>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="mt-0.5 block text-sm text-muted">{d}</span>
              </button>
            ))}
          </div>
          {v.vatRegime === "assujetti" ? <div className="max-w-sm">{text("vatNumber", "Numéro de TVA", { placeholder: "BE 1234.567.890" })}</div> : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Paiement" description="L'IBAN et le QR de paiement apparaissent sur chaque facture." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div className="sm:col-span-2">{text("iban", "IBAN", { placeholder: "BE00 0000 0000 0000" })}</div>
          {text("bic", "BIC (facultatif)")}
          <Field label="Délai de paiement" htmlFor="s-paymentDays">
            <Select id="s-paymentDays" value={String(v.paymentDays)} disabled={!canManage} onChange={(e) => set("paymentDays", Number(e.target.value))}>
              {[0, 8, 15, 30, 45, 60].map((n) => <option key={n} value={n}>{n === 0 ? "À réception" : `${n} jours`}</option>)}
            </Select>
          </Field>
          {text("prefix", "Préfixe des numéros (facultatif)", { placeholder: "Ex. SKY", hint: "SKY-2026-001. Ne changez plus en cours d'année." })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Apparence et textes" />
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-sm font-medium">Couleur des documents</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
              {COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={v.color === c} aria-label={c} disabled={!canManage} onClick={() => set("color", c)} className={cn("size-9 rounded-full border-2 transition-transform hover:scale-105", v.color === c ? "border-text" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
          </div>
          <Field label="Note par défaut" htmlFor="s-defaultNotes" hint="Pré-remplie sur chaque nouveau document.">
            <Textarea id="s-defaultNotes" rows={2} value={v.defaultNotes} disabled={!canManage} onChange={(e) => set("defaultNotes", e.target.value)} />
          </Field>
          <Field label="Pied de page (facultatif)" htmlFor="s-footerNote" hint="Ex. : conditions générales, pénalités de retard.">
            <Textarea id="s-footerNote" rows={2} value={v.footerNote} disabled={!canManage} onChange={(e) => set("footerNote", e.target.value)} />
          </Field>
        </div>
      </Card>

      {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {canManage ? <Button loading={pending} onClick={submit}>Enregistrer</Button> : null}
    </div>
  );
}
