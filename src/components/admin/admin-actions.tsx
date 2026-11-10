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

export function GrantPlanForm({ businessId, plan, until, suggested, skydev = false }: { businessId: string; plan: string; until: string; suggested: string; skydev?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Safari affiche la date du jour en gris dans un champ vide : on pré-remplit vraiment (dans un an) pour éviter
  // d'enregistrer un champ vide en croyant donner l'accès (ce qui le retirait).
  const [date, setDate] = useState(until || suggested);
  const [forever, setForever] = useState(until >= "2099-01-01");
  const send = (u: string) =>
    start(async () => {
      const form = document.getElementById(`grant-${businessId}`) as HTMLFormElement | null;
      const p = form ? String(new FormData(form).get("plan")) : "pro";
      const r = await grantPlan(businessId, { plan: p, until: u });
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
    });
  return (
    <form
      id={`grant-${businessId}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!forever && !date) return setMsg({ ok: false, text: "Choisissez une date de fin, ou « Sans date de fin »." });
        send(forever ? "2099-12-31" : date);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Forfait offert" htmlFor="plan">
          {/* Skydev : un seul abonnement, qui donne les droits Pro+ (toutes les apps). */}
          {skydev ? (
            <Select id="plan" name="plan" defaultValue="pro_plus">
              <option value="pro_plus">Skydev (toutes les apps)</option>
            </Select>
          ) : (
            <Select id="plan" name="plan" defaultValue={plan === "free" ? "pro" : plan}>
              <option value="pro">Pro</option>
              <option value="pro_plus">Pro+</option>
            </Select>
          )}
        </Field>
        <Field label="Jusqu'au" htmlFor="until">
          <Input id="until" name="until" type="date" value={forever ? "" : date} onChange={(e) => setDate(e.target.value)} disabled={forever} required={!forever} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={forever} onChange={(e) => setForever(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Sans date de fin (accès offert à vie)
      </label>
      {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>Enregistrer</Button>
        {plan !== "free" ? <Button type="button" variant="ghost" disabled={pending} onClick={() => window.confirm("Retirer l'accès offert ?") && send("")}>Retirer l&apos;accès offert</Button> : null}
      </div>
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
