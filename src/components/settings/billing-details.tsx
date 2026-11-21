"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { useT } from "@/components/app-locale";
import { cn } from "@/lib/cn";
import { saveBillingDetails } from "@/server/actions/billing-methods";
import type { BillingDetails } from "@/server/billing-methods";

const COUNTRIES = [
  ["BE", "Belgique"],
  ["FR", "France"],
  ["LU", "Luxembourg"],
  ["NL", "Pays-Bas"],
  ["DE", "Allemagne"],
  ["CH", "Suisse"],
] as const;

/** Coordonnées de facturation : ce qui est imprimé sur les factures (obligatoire en B2B : n° de TVA du client). */
export function BillingDetailsForm({ initial, canManage }: { initial: BillingDetails | null; canManage: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ name: initial?.name ?? "", line1: initial?.line1 ?? "", postalCode: initial?.postalCode ?? "", city: initial?.city ?? "", country: initial?.country || "BE", vat: initial?.vat ?? "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const missing = !initial?.line1;

  return (
    <Card id="coordonnees">
      <CardHeader
        title={t("Coordonnées de facturation")}
        description={t("Imprimées sur vos factures. Indépendant ou société assujetti à la TVA : ajoutez votre numéro de TVA, il est obligatoire sur une facture entre professionnels.")}
        action={initial?.vat ? <Badge tone={initial.vatStatus === "verified" ? "success" : initial.vatStatus === "unverified" ? "danger" : "neutral"}>{initial.vatStatus === "verified" ? t("TVA vérifiée") : initial.vatStatus === "unverified" ? t("TVA non reconnue") : t("TVA en vérification")}</Badge> : null}
      />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          start(async () => {
            const r = await saveBillingDetails(v);
            setErr(r.ok ? {} : (r.fieldErrors ?? {}));
            setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
            if (r.ok) router.refresh();
          });
        }}
      >
        {missing ? <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{t("Adresse manquante : complétez-la pour pouvoir payer en un clic et recevoir des factures complètes.")}</p> : null}
        <Field label={t("Nom ou société")} htmlFor="bd-name" error={err.name}>
          <Input id="bd-name" value={v.name} onChange={set("name")} autoComplete="organization" disabled={!canManage} required />
        </Field>
        <Field label={t("Rue et numéro")} htmlFor="bd-line1" error={err.line1}>
          <Input id="bd-line1" value={v.line1} onChange={set("line1")} autoComplete="address-line1" disabled={!canManage} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr_12rem]">
          <Field label={t("Code postal")} htmlFor="bd-pc" error={err.postalCode}>
            <Input id="bd-pc" value={v.postalCode} onChange={set("postalCode")} autoComplete="postal-code" disabled={!canManage} required />
          </Field>
          <Field label={t("Ville")} htmlFor="bd-city" error={err.city}>
            <Input id="bd-city" value={v.city} onChange={set("city")} autoComplete="address-level2" disabled={!canManage} required />
          </Field>
          <Field label={t("Pays")} htmlFor="bd-country" error={err.country}>
            <Select id="bd-country" value={v.country} onChange={set("country")} disabled={!canManage}>
              {COUNTRIES.map(([c, label]) => (
                <option key={c} value={c}>{t(label)}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("Numéro de TVA (si assujetti)")} htmlFor="bd-vat" error={err.vat} hint={t("Ex. BE0123456789. Laissez vide si vous n'êtes pas assujetti à la TVA.")}>
          <Input id="bd-vat" value={v.vat} onChange={set("vat")} placeholder="BE0123456789" autoComplete="off" disabled={!canManage} className="sm:max-w-xs" />
        </Field>
        {canManage ? <Button type="submit" loading={pending}>{t("Enregistrer")}</Button> : null}
        {msg?.text ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
      </form>
    </Card>
  );
}
