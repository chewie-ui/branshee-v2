"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOrderInvoice } from "@/server/actions/order-invoice";

type Labels = { ask: string; help: string; street: string; postal: string; city: string; company: string; vat: string; submit: string; busy: string };

/** Demande de facture d'une commande : l'adresse du client doit figurer sur la facture. */
export function OrderInvoiceForm({ token, labels, initial }: { token: string; labels: Labels; initial?: { street: string; postalCode: string; city: string } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const input = "mt-1 h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <form
      className="mt-4 rounded-xl border border-border p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await requestOrderInvoice(token, Object.fromEntries(fd));
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <p className="font-medium">{labels.ask}</p>
      <p className="mt-0.5 text-muted">{labels.help}</p>
      <label className="mt-3 block">{labels.street}<input name="street" required defaultValue={initial?.street ?? ""} autoComplete="street-address" className={input} /></label>
      <div className="mt-2 grid grid-cols-[7rem_1fr] gap-2">
        <label className="block">{labels.postal}<input name="postalCode" required inputMode="numeric" pattern="\d{4,5}" defaultValue={initial?.postalCode ?? ""} autoComplete="postal-code" className={input} /></label>
        <label className="block">{labels.city}<input name="city" required defaultValue={initial?.city ?? ""} autoComplete="address-level2" className={input} /></label>
      </div>
      <label className="mt-2 block">{labels.company}<input name="company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" className={input} /></label>
      {company.trim() ? <label className="mt-2 block">{labels.vat}<input name="vatNumber" required className={input} /></label> : null}
      {error ? <p className="mt-2 text-danger" role="alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="mt-3 inline-flex h-11 items-center rounded-lg bg-accent px-4 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{pending ? labels.busy : labels.submit}</button>
    </form>
  );
}
