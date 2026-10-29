"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Gift, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ADDONS, LIMITS, PLANS, PLAN_RANK, eur, excludingVat, type Plan } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { cancelPlan, checkPromo, choosePlan, claimReferral, openBillingPortal, resumePlan, setCustomUrlAddon, setExtraSeats } from "@/server/actions/billing";

type Current = { plan: Plan; source: string; status: string; periodEnd: string | null; cancelAtPeriodEnd: boolean; grantedUntil: string | null; isTrial: boolean; extraSeats: number; customUrlAddon: boolean; interval: "month" | "year" | null };
type R = { ok: true; message?: string; url?: string } | { ok: false; error: string };

const FEATURES: { label: string; pro: string | boolean; pro_plus: string | boolean }[] = [
  { label: "Réservation en ligne illimitée, prestations illimitées", pro: true, pro_plus: true },
  { label: "Rappels automatiques par email", pro: true, pro_plus: true },
  { label: "SMS inclus par mois", pro: String(LIMITS.smsIncluded.pro), pro_plus: String(LIMITS.smsIncluded.pro_plus) },
  { label: "Collaborateurs inclus", pro: String(LIMITS.collaborators.pro), pro_plus: String(LIMITS.collaborators.pro_plus) },
  { label: "Questions avant réservation", pro: String(LIMITS.formQuestions.pro), pro_plus: String(LIMITS.formQuestions.pro_plus) },
  { label: "Personnalisation de la page, réseaux sociaux", pro: true, pro_plus: true },
  { label: "Synchronisation Google Agenda", pro: true, pro_plus: true },
  { label: "Grades sur mesure, journal d'activité", pro: false, pro_plus: true },
  { label: "Mon site, URL personnalisée, sans mention Branshee", pro: false, pro_plus: true },
];

const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "");

export function BillingPanel({
  current,
  enabled,
  campaign,
  canManage,
  offer = null,
  lockedCents = null,
}: {
  current: Current;
  enabled: boolean;
  campaign: { endsAt: string | null; firstPeriodCents: number; plan: Plan } | null;
  canManage: boolean;
  /** Code promo mis en avant par l'équipe (pré-rempli). */
  offer?: { code: string; label: string } | null;
  /** Tarif Pro garanti à vie (centimes TVAC), fixé par l'équipe. */
  lockedCents?: number | null;
}) {
  const [interval, setInterval_] = useState<"month" | "year">(current.interval ?? "month");
  const [promo, setPromo] = useState(offer?.code ?? "");
  const [promoInfo, setPromoInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) =>
    start(async () => {
      const r = await fn();
      if (r.ok && r.url) {
        window.location.href = r.url;
        return;
      }
      setMsg(r.ok ? { ok: true, text: r.message ?? "Fait." } : { ok: false, text: r.error });
    });
  const paid = current.source === "stripe" || current.source === "account";
  const now = useNow();
  // Essai gratuit en cours : compte à rebours jusqu'à sa fin (s'abonner avant, c'est payer dès aujourd'hui).
  const trialEnd = !paid && current.isTrial && current.source === "granted" && current.grantedUntil ? new Date(current.grantedUntil) : null;
  const trialOffer = !!trialEnd && (now === null || trialEnd.getTime() > now);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Votre forfait" />
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex-1">
            <p className="text-2xl font-semibold">{current.isTrial && current.source === "granted" ? `${PLANS[current.plan].label} — essai gratuit` : PLANS[current.plan].label}</p>
            <p className="text-sm text-muted">
              {current.source === "granted"
                ? current.isTrial && current.grantedUntil
                  ? `Essai gratuit jusqu'au ${fmtDate(current.grantedUntil)}. Abonnez-vous avant cette date pour garder votre réservation en ligne ouverte.`
                  : current.grantedUntil
                    ? `Accès offert jusqu'au ${fmtDate(current.grantedUntil)}.`
                    : "Accès offert."
                : paid
                  ? current.cancelAtPeriodEnd
                    ? `Résilié : actif jusqu'au ${fmtDate(current.periodEnd)}.`
                    : current.status === "past_due"
                      ? "Paiement en retard : mettez à jour votre carte pour garder votre forfait."
                      : current.status === "trialing"
                        ? `Période d'essai jusqu'au ${fmtDate(current.periodEnd)}.`
                        : current.periodEnd
                          ? `Prochain renouvellement le ${fmtDate(current.periodEnd)} (${current.interval === "year" ? "annuel" : "mensuel"}).`
                          : "Abonnement actif."
                  : "Pas d'abonnement actif : votre réservation en ligne est fermée. Choisissez un forfait pour la rouvrir."}
            </p>
          </div>
          {paid && canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" loading={pending} onClick={() => run(openBillingPortal)}>Cartes et factures</Button>
              {current.cancelAtPeriodEnd ? <Button size="sm" loading={pending} onClick={() => run(resumePlan)}>Reprendre l&apos;abonnement</Button> : <Button variant="ghost" size="sm" loading={pending} onClick={() => run(cancelPlan)}>Résilier</Button>}
            </div>
          ) : null}
        </div>
        {msg ? <p className={cn("px-5 pb-4 text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </Card>

      {trialOffer && trialEnd ? <TrialCountdown end={trialEnd} now={now} /> : campaign && !paid ? <Countdown campaign={campaign} /> : null}
      {offer && !campaign && !paid ? (
        <p className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm" role="status">
          <span className="font-semibold text-accent-soft-foreground">Offre en cours : {offer.label}</span> avec le code <span className="font-mono font-semibold">{offer.code}</span> (déjà saisi ci-dessous).
        </p>
      ) : null}

      <Card>
        <CardHeader title={paid ? "Changer de forfait" : "Choisir un forfait"} description="Sans engagement, résiliable en un clic. Un changement en cours de mois est calculé au prorata." />
        <div className="space-y-5 p-5">
          {!enabled ? <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">Le paiement des abonnements n&apos;est pas encore configuré sur ce serveur (clés Stripe).</p> : null}
          <div className="inline-flex rounded-lg bg-surface-muted p-1" role="radiogroup" aria-label="Période">
            {(["month", "year"] as const).map((i) => (
              <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval_(i)} className={cn("h-8 rounded-md px-4 text-sm font-medium", interval === i ? "bg-surface shadow-sm" : "text-muted")}>
                {i === "month" ? "Mensuel" : "Annuel (-20 %)"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(["pro", "pro_plus"] as const).map((p) => {
              const locked = p === "pro" && lockedCents ? lockedCents / 100 : null;
              const price = locked ?? (interval === "year" ? Math.round((PLANS[p].yearly / 12) * 100) / 100 : PLANS[p].monthly);
              // Pendant l'essai ou un accès offert, le forfait affiché n'est pas encore payé : on peut s'y abonner.
              const isCurrent = current.plan === p && paid;
              return (
                <div key={p} className={cn("flex flex-col rounded-xl border p-5", isCurrent ? "border-accent ring-1 ring-accent" : "border-border")}>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{PLANS[p].label}{locked ? <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Tarif garanti à vie</span> : null}</p>
                  <p className="mt-1 text-sm text-muted">{PLANS[p].tagline}</p>
                  <p className="mt-4">
                    <span className="text-3xl font-semibold">{eur(price)}</span>
                    <span className="text-sm text-muted"> TVAC / mois</span>
                  </p>
                  <p className="text-xs text-muted">{locked ? "Facturé chaque mois · " : interval === "year" ? `Facturé ${eur(PLANS[p].yearly)} TVAC par an · ` : ""}{excludingVat(price)} HTVA / mois</p>
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                    {FEATURES.map((f) => {
                      const v = f[p];
                      if (v === false) return null;
                      return (
                        <li key={f.label} className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                          <span>{f.label}{typeof v === "string" ? ` : ${v}` : ""}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <p className="text-center text-sm font-medium text-accent">Forfait actuel</p>
                    ) : canManage ? (
                      <Button className="w-full" variant={!paid || PLAN_RANK[p] > PLAN_RANK[current.plan] ? "primary" : "secondary"} loading={pending} disabled={!enabled} onClick={() => run(() => choosePlan({ plan: p, interval, promo: promo || undefined }))}>
                        {paid ? `Passer à ${PLANS[p].label}` : `S'abonner à ${PLANS[p].label}`}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {!paid && canManage ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await checkPromo({ code: promo, plan: "pro", interval });
                  setPromoInfo(r.ok ? { ok: true, text: `Code valable : ${r.label}. Il sera appliqué au paiement.` } : { ok: false, text: r.error });
                });
              }}
            >
              <Input value={promo} onChange={(e) => { setPromo(e.target.value.toUpperCase()); setPromoInfo(null); }} placeholder="Code promo" aria-label="Code promo" className="w-44 uppercase" maxLength={40} />
              <Button type="submit" variant="secondary" size="sm" disabled={!promo}>Vérifier</Button>
              {promoInfo ? <span className={cn("text-sm", promoInfo.ok ? "text-success" : "text-danger")}>{promoInfo.text}</span> : null}
            </form>
          ) : null}
        </div>
      </Card>

      {paid && canManage ? <Addons current={current} run={run} pending={pending} /> : null}
    </div>
  );
}

function Addons({ current, run, pending }: { current: Current; run: (fn: () => Promise<R>) => void; pending: boolean }) {
  const [seats, setSeats] = useState(current.extraSeats);
  return (
    <Card>
      <CardHeader title="Options" description="Ajoutées à votre abonnement, au prorata." />
      <div className="divide-y divide-border">
        {current.plan === "pro" ? (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="flex-1 text-sm">
              <p className="font-medium">{ADDONS.customUrl.label}</p>
              <p className="text-muted">branshee.com/votre-nom — {ADDONS.customUrl.monthly} € TVAC/mois (incluse dans Pro+).</p>
            </div>
            <Button size="sm" variant={current.customUrlAddon ? "ghost" : "secondary"} loading={pending} onClick={() => run(() => setCustomUrlAddon(!current.customUrlAddon))}>{current.customUrlAddon ? "Retirer" : "Ajouter"}</Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex-1 text-sm">
            <p className="font-medium">Sièges collaborateurs supplémentaires</p>
            <p className="text-muted">{ADDONS.seat.monthly} € TVAC/mois par siège, en plus des {LIMITS.collaborators[current.plan]} inclus.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSeats((s) => Math.max(0, s - 1))} className="flex size-9 items-center justify-center rounded-lg border border-border-strong" aria-label="Un siège de moins"><Minus className="size-4" aria-hidden="true" /></button>
            <span className="w-8 text-center font-medium tabular-nums">{seats}</span>
            <button type="button" onClick={() => setSeats((s) => Math.min(50, s + 1))} className="flex size-9 items-center justify-center rounded-lg border border-border-strong" aria-label="Un siège de plus"><Plus className="size-4" aria-hidden="true" /></button>
            <Button size="sm" variant="secondary" loading={pending} disabled={seats === current.extraSeats} onClick={() => run(() => setExtraSeats(seats))}>Valider</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Heure courante, rafraîchie chaque seconde (null avant le montage, pour un rendu serveur identique). */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().getTime());
    const t = setTimeout(tick, 0);
    const i = window.setInterval(tick, 1000);
    return () => { clearTimeout(t); window.clearInterval(i); };
  }, []);
  return now;
}

/** Fin de l'essai gratuit : vraie échéance, après laquelle la réservation en ligne se ferme sans abonnement. */
function TrialCountdown({ end, now }: { end: Date; now: number | null }) {
  const left = now !== null ? Math.max(0, end.getTime() - now) : null;
  const d = left != null ? Math.floor(left / 86400000) : 0;
  const h = left != null ? Math.floor((left % 86400000) / 3600000) : 0;
  const m = left != null ? Math.floor((left % 3600000) / 60000) : 0;
  const sec = left != null ? Math.floor((left % 60000) / 1000) : 0;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-accent/30 bg-accent-soft p-5">
      <Gift className="size-6 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-56 text-sm">
        <p className="font-semibold text-accent-soft-foreground">Votre essai gratuit se termine le {fmtDate(end.toISOString())}</p>
        <p className="text-muted">Abonnez-vous avant pour que vos clients continuent à réserver en ligne. Sans engagement, résiliable en un clic.</p>
      </div>
      {left != null ? (
        <div className="w-full sm:w-auto sm:text-right">
          <p className="text-xs text-muted">Fin de l&apos;essai dans</p>
          <p className="font-mono text-lg font-semibold tabular-nums" aria-label="Temps restant avant la fin de l'essai">{d}j {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")}</p>
        </div>
      ) : null}
    </div>
  );
}

function Countdown({ campaign }: { campaign: { endsAt: string | null; firstPeriodCents: number; plan: Plan } }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().getTime());
    const t = setTimeout(tick, 0);
    const i = window.setInterval(tick, 1000);
    return () => { clearTimeout(t); window.clearInterval(i); };
  }, []);
  const left = campaign.endsAt && now ? Math.max(0, new Date(campaign.endsAt).getTime() - now) : null;
  const d = left != null ? Math.floor(left / 86400000) : 0;
  const h = left != null ? Math.floor((left % 86400000) / 3600000) : 0;
  const m = left != null ? Math.floor((left % 3600000) / 60000) : 0;
  const sec = left != null ? Math.floor((left % 60000) / 1000) : 0;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-accent/30 bg-accent-soft p-5">
      <Gift className="size-6 text-accent" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-accent-soft-foreground">Offre de lancement : {PLANS[campaign.plan].label} à {(campaign.firstPeriodCents / 100).toFixed(2).replace(".", ",")} € le premier mois</p>
        <p className="text-muted">Une seule fois par compte, en mensuel. Ensuite {eur(PLANS[campaign.plan].monthly)} TVAC/mois, sans engagement.</p>
      </div>
      {left != null ? <p className="font-mono text-lg font-semibold tabular-nums" aria-label="Temps restant">{d}j {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")}</p> : null}
    </div>
  );
}

export function ReferralCard({ code, link, paying, claimable, claimed, invited }: { code: string; link: string; paying: number; claimable: number; claimed: number; invited: { name: string; createdAt: string; paying: boolean }[] }) {
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Parrainage" description="1 mois offert pour chaque pro qui s'abonne grâce à vous (après son 2e paiement)." />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted p-1 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm">{link.replace(/^https?:\/\//, "")}</span>
          <Button size="sm" variant="secondary" icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* indisponible */ } }}>{copied ? "Copié" : "Copier"}</Button>
        </div>
        <p className="text-sm text-muted">Votre code : <span className="font-mono font-medium text-text">{code}</span></p>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg bg-surface-muted p-3"><p className="text-xl font-semibold">{invited.length}</p><p className="text-muted">inscrits</p></div>
          <div className="rounded-lg bg-surface-muted p-3"><p className="text-xl font-semibold">{paying}</p><p className="text-muted">abonnés</p></div>
          <div className="rounded-lg bg-surface-muted p-3"><p className="text-xl font-semibold">{claimable}</p><p className="text-muted">mois à réclamer</p></div>
        </div>
        {claimable > 0 ? <Button loading={pending} onClick={() => start(async () => { const r = await claimReferral(); setMsg(r.ok ? { ok: true, text: r.message ?? "Fait." } : { ok: false, text: r.error }); })}>Utiliser mes {claimable} mois offerts</Button> : null}
        {claimed ? <p className="text-sm text-muted">{claimed} mois déjà utilisés.</p> : null}
        {msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p> : null}
        {invited.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {invited.map((f, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5">
                <span>{f.name}</span>
                <span className={f.paying ? "text-success" : "text-muted"}>{f.paying ? "Abonné" : `Inscrit le ${fmtDate(f.createdAt)}`}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
