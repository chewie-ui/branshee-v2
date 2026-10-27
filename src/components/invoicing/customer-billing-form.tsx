"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { saveCustomerBilling } from "@/server/actions/invoicing";

type V = { company: string; vatNumber: string; street: string; postalCode: string; city: string; country: string };

/** Fiche client › coordonnées de facturation (utilisées par l'app Factures). */
export function CustomerBillingForm({ customerId, initial }: { customerId: string; initial: V }) {
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
      <CardHeader title="Facturation" description="Société, TVA et adresse, reprises sur les factures et devis." />
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {f("company", "Société (facultatif)", { autoComplete: "organization" })}
          {f("vatNumber", "TVA / N° d'entreprise")}
          {f("street", "Rue et numéro", { autoComplete: "street-address" })}
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
            {f("postalCode", "Code postal", { autoComplete: "postal-code" })}
            {f("city", "Ville", { autoComplete: "address-level2" })}
          </div>
        </div>
        {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
        <Button size="sm" loading={pending} onClick={() => start(async () => { const r = await saveCustomerBilling(customerId, v); setMsg(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: r.error }); })}>Enregistrer</Button>
      </div>
    </Card>
  );
}
