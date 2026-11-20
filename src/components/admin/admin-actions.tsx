"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { grantPlan, setBusinessPaused, setLockedPrice, setUserDisabled, setUserPricing } from "@/server/actions/admin";
import { MAX_USERS, teamQuote, tierLabels } from "@/lib/skydev-plans";

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

const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const fmt = (n: number) => `${n.toFixed(2).replace(".", ",").replace(",00", "")} €`;

/**
 * Skydev : utilisateurs offerts et prix par utilisateur (super-admin). Aperçu en direct du prix de l'équipe
 * et d'une équipe plus grande, avant d'enregistrer.
 */
export function UserPricingForm({ businessId, teamSize, offered, first, extra, granted }: { businessId: string; teamSize: number; offered: number; first: number | null; extra: number | null; granted: boolean }) {
  const [pending, start] = useTransition();
  const [nOffered, setOffered] = useState(String(offered));
  const [custom, setCustom] = useState(first != null);
  const [vFirst, setFirst] = useState(first != null ? String(first).replace(".", ",") : "29");
  const [vExtra, setExtra] = useState(extra != null ? String(extra).replace(".", ",") : first != null ? String(first).replace(".", ",") : "15");
  const [sim, setSim] = useState(Math.max(teamSize, 3));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pricing = { offered: Math.max(0, Math.round(Number(nOffered) || 0)), first: custom ? toNum(vFirst) : null, extra: custom ? toNum(vExtra) : null };
  const valid = (!custom || (pricing.first != null && !Number.isNaN(pricing.first))) && pricing.offered <= MAX_USERS;
  const now = teamQuote(teamSize, pricing);
  const simQ = teamQuote(sim, pricing);
  const line = (q: ReturnType<typeof teamQuote>) => `${q.billed} facturé${q.billed > 1 ? "s" : ""}${q.offered ? ` + ${q.offered} offert${q.offered > 1 ? "s" : ""}` : ""} = ${fmt(q.monthly)} TVAC / mois`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        start(async () => {
          const r = await setUserPricing(businessId, pricing);
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
        });
      }}
      className="space-y-5"
    >
      <Field label="Utilisateurs offerts" htmlFor="offered-users" hint={granted ? "Avec l'accès offert, il peut ajouter au moins ce nombre de personnes à son équipe." : "Le titulaire paie 1 utilisateur ; ces personnes ne sont pas facturées. Pour tout offrir, utilisez l'accès offert ci-dessus."}>
        <div className="flex items-center gap-2">
          <Input id="offered-users" type="number" inputMode="numeric" min={0} max={MAX_USERS} value={nOffered} onChange={(e) => setOffered(e.target.value)} className="w-28" />
          <span className="text-sm text-muted">utilisateur{pricing.offered > 1 ? "s" : ""} en plus du titulaire</span>
        </div>
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Prix par utilisateur</legend>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-accent">
          <input type="radio" name="pricing-mode" className="mt-1 size-4 accent-[var(--accent)]" checked={!custom} onChange={() => setCustom(false)} />
          <span className="text-sm"><span className="font-medium">Prix public dégressif</span><span className="block text-muted">{tierLabels().map((t) => `${t.label} ${t.price} €`).join(" · ")}</span></span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-accent">
          <input type="radio" name="pricing-mode" className="mt-1 size-4 accent-[var(--accent)]" checked={custom} onChange={() => setCustom(true)} />
          <span className="text-sm"><span className="font-medium">Prix personnalisé</span><span className="block text-muted">Le 1er utilisateur facturé à un prix, chaque utilisateur en plus à un autre (ou le même).</span></span>
        </label>
        {custom ? (
          <div className="grid gap-4 pl-1 sm:grid-cols-2">
            <Field label="1er utilisateur" htmlFor="price-first">
              <div className="flex items-center gap-2">
                <Input id="price-first" inputMode="decimal" value={vFirst} onChange={(e) => setFirst(e.target.value)} className="w-28" />
                <span className="text-sm text-muted">€ / mois TVAC</span>
              </div>
            </Field>
            <Field label="Chaque utilisateur en plus" htmlFor="price-extra">
              <div className="flex items-center gap-2">
                <Input id="price-extra" inputMode="decimal" value={vExtra} onChange={(e) => setExtra(e.target.value)} className="w-28" />
                <span className="text-sm text-muted">€ / mois TVAC</span>
              </div>
            </Field>
          </div>
        ) : null}
      </fieldset>

      <div className="space-y-2 rounded-lg bg-surface-muted p-4 text-sm" aria-live="polite">
        <p><span className="font-medium">Équipe actuelle ({teamSize}) :</span> {granted ? "accès offert, rien n'est facturé pour l'instant. Si l'établissement s'abonne : " : ""}{valid ? line(now) : "—"}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sim-users" className="font-medium">Avec</label>
          <Input id="sim-users" type="number" min={1} max={MAX_USERS} value={sim} onChange={(e) => setSim(Math.min(Math.max(Number(e.target.value) || 1, 1), MAX_USERS))} className="h-9 w-20" />
          <span>personnes : {valid ? line(simQ) : "—"}</span>
        </div>
        <p className="text-muted">Annuel : 10 mois payés, 2 offerts. Un abonnement en cours suit tout de suite (nombre d&apos;utilisateurs au prorata, nouveau prix à la prochaine facture).</p>
      </div>
      {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      <Button type="submit" loading={pending} disabled={!valid}>Enregistrer</Button>
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
