"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { saveCustomerBilling } from "@/server/actions/invoicing";
import { useT } from "@/components/app-locale";

type V = { company: string; vatNumber: string; street: string; postalCode: string; city: string; country: string };

/** Fiche client › coordonnées de facturation (utilisées par l'app Factures). */
export function CustomerBillingForm({ customerId, initial }: { customerId: string; initial: V }) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const f = (k: keyof V, label: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <Field label={label} htmlFor={`cb-${k}`}>
      <Input id={`cb-${k}`} value={v[k]} onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))} {...extra} />
    </Field>
  );
  return (
    <Card>
      <CardHeader title="Facturation" description={t("Société, TVA et adresse, reprises sur les factures et devis.")} />
      <div className="space-y-4 p-5">
        {/* La carte vit dans une colonne étroite : une info par ligne, code postal et ville côte à côte. */}
        <div className="space-y-4">
          {f("company", t("Société (facultatif)"), { autoComplete: "organization" })}
          {f("vatNumber", t("TVA / N° d'entreprise"))}
          {f("street", t("Rue et numéro"), { autoComplete: "street-address" })}
          <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
            {f("postalCode", t("Code postal"), { autoComplete: "postal-code", inputMode: "numeric" })}
            {f("city", t("Ville"), { autoComplete: "address-level2" })}
          </div>
        </div>
        {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
        <Button size="sm" loading={pending} onClick={() => start(async () => { const r = await saveCustomerBilling(customerId, v); setMsg(r.ok ? { ok: true, text: r.message ?? t("Enregistré.") } : { ok: false, text: r.error }); })}>{t("Enregistrer")}</Button>
      </div>
    </Card>
  );
}
