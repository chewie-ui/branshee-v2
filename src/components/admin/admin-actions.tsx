"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { grantPlan, setBusinessPaused, setLockedPrice, setUserDisabled } from "@/server/actions/admin";

export function PauseToggle({ id, paused }: { id: string; paused: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const run = () => start(async () => { await setBusinessPaused(id, !paused); setConfirm(false); });
  if (paused) return <Button variant="secondary" loading={pending} onClick={run}>Réactiver la réservation en ligne</Button>;
  if (!confirm) return <Button variant="secondary" className="text-danger hover:text-danger" onClick={() => setConfirm(true)}>Mettre en pause</Button>;
  return (
    <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
      <p className="text-sm text-danger">Les clients ne pourront plus réserver en ligne. L&apos;espace pro reste accessible.</p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>Non</Button>
        <Button variant="danger" size="sm" loading={pending} onClick={run}>Oui, mettre en pause</Button>
      </div>
    </div>
  );
}

export function GrantPlanForm({ businessId, plan, until }: { businessId: string; plan: string; until: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await grantPlan(businessId, { plan: String(fd.get("plan")), until: String(fd.get("until") ?? "") });
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Forfait offert" htmlFor="plan">
          <Select id="plan" name="plan" defaultValue={plan === "free" ? "pro" : plan}>
            <option value="pro">Pro</option>
            <option value="pro_plus">Pro+</option>
          </Select>
        </Field>
        <Field label="Jusqu'au" htmlFor="until" hint="Laisser vide pour retirer l'accès offert.">
          <Input id="until" name="until" type="date" defaultValue={until} />
        </Field>
      </div>
      {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <Button type="submit" loading={pending}>Enregistrer</Button>
    </form>
  );
}

/** Tarif Pro garanti à vie (ex. 19 €/mois promis aux premières clientes). */
export function LockedPriceForm({ businessId, cents }: { businessId: string; cents: number | null }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(cents ? String(cents / 100).replace(".", ",") : "19");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (euros: number | null) =>
    start(async () => {
      const r = await setLockedPrice(businessId, euros);
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(Number(value.replace(",", ".")));
      }}
      className="space-y-4"
    >
      <Field label="Prix du forfait Pro, par mois, TVAC" htmlFor="locked-price" hint="Remplace le prix public pour cet établissement, à vie (abonnement mensuel).">
        <div className="flex items-center gap-2">
          <Input id="locked-price" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="w-28" aria-describedby="locked-price-unit" />
          <span id="locked-price-unit" className="text-sm text-muted">€ / mois TVAC</span>
        </div>
      </Field>
      {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>{cents ? "Modifier le tarif garanti" : "Garantir ce tarif à vie"}</Button>
        {cents ? <Button type="button" variant="ghost" disabled={pending} onClick={() => run(null)}>Retirer</Button> : null}
      </div>
    </form>
  );
}

export function DisableUserButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={disabled ? "secondary" : "ghost"}
        size="sm"
        className={disabled ? undefined : "text-danger hover:text-danger"}
        loading={pending}
        onClick={() => start(async () => { const r = await setUserDisabled(id, !disabled); setError(r.ok ? null : (r.error ?? "Erreur.")); })}
      >
        {disabled ? "Réactiver" : "Désactiver"}
      </Button>
      {error ? <span className="text-sm text-danger" role="alert">{error}</span> : null}
    </div>
  );
}
