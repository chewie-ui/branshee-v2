"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Globe, MessageSquareText, Minus, PhoneCall, Plus, UserPlus, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { eur, excludingVat, type Plan } from "@/lib/plans";
import { SKYDEV_ADDONS, SKYDEV_PLANS, type PaidPlan } from "@/lib/skydev-plans";
import { cancelPlan, choosePlan, openBillingPortal, resumePlan, setCustomUrlAddon, setExtraSeats, setModuleAddon } from "@/server/actions/billing";

export type SkydevCurrent = {
  plan: Plan;
  source: string;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  grantedUntil: string | null;
  isTrial: boolean;
  extraSeats: number;
  customUrlAddon: boolean;
  interval: "month" | "year" | null;
  modules: string[];
};
type R = { ok: true; message?: string; url?: string } | { ok: false; error: string };

const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "");
const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

/** Abonnement Skydev : un forfait (Solo ou Équipe) pour toutes les apps incluses, et des options sur le même abonnement. */
export function SkydevBillingPanel({ current, enabled, canManage }: { current: SkydevCurrent; enabled: boolean; canManage: boolean }) {
  const [interval, setInterval_] = useState<"month" | "year">(current.interval ?? "month");
  const [seats, setSeats] = useState(current.extraSeats);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const run = (key: string, fn: () => Promise<R>) => {
    setBusy(key);
    setMsg(null);
    start(async () => {
      const r = await fn().catch(() => ({ ok: false as const, error: "Une erreur est survenue. Réessayez dans un instant." }));
      if (r.ok && r.url) {
        window.location.href = r.url;
        return;
      }
      setBusy(null);
      setMsg(r.ok ? { ok: true, text: r.message ?? "C'est fait." } : { ok: false, text: r.error });
    });
  };

  const paid = current.source === "stripe" || current.source === "account";
  const trial = !paid && current.isTrial && current.source === "granted" && current.grantedUntil;
  const planName = current.plan === "free" ? null : SKYDEV_PLANS[current.plan].label;
  const telIa = current.modules.includes("tel_ia");
  const lockedReason = !paid ? "Les options s'ajoutent à votre abonnement : choisissez d'abord Solo ou Équipe." : null;

  return (
    <div className="space-y-6">
      {/* État de l'abonnement */}
      <Card>
        <CardHeader title="Votre abonnement" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-semibold tracking-tight">{trial ? `Essai gratuit` : paid && planName ? planName : current.source === "granted" && planName ? `${planName} (accès offert)` : "Aucun abonnement"}</p>
              {trial ? <Badge tone="accent">encore {daysLeft(current.grantedUntil!)} jour{daysLeft(current.grantedUntil!) > 1 ? "s" : ""}</Badge> : null}
              {paid && current.status === "past_due" ? <Badge tone="danger">Paiement en retard</Badge> : null}
              {paid && current.cancelAtPeriodEnd ? <Badge tone="warning">Résilié</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {trial
                ? `Toutes les apps sont ouvertes jusqu'au ${fmtDate(current.grantedUntil)}. Choisissez un abonnement pour continuer ensuite : le paiement commence le jour où vous vous abonnez.`
                : paid
                  ? current.cancelAtPeriodEnd
                    ? `Votre abonnement reste actif jusqu'au ${fmtDate(current.periodEnd)}, puis s'arrête.`
                    : current.status === "past_due"
                      ? "Le dernier paiement n'est pas passé : mettez à jour votre carte pour garder vos apps."
                      : `${current.interval === "year" ? "Annuel" : "Mensuel"}${current.periodEnd ? `, prochain renouvellement le ${fmtDate(current.periodEnd)}` : ""}.`
                  : current.source === "granted"
                    ? current.grantedUntil
                      ? `Accès offert jusqu'au ${fmtDate(current.grantedUntil)}.`
                      : "Accès offert par l'équipe Skydev."
                    : "Vos apps sont en pause : votre réservation en ligne est fermée. Vos données restent là. Choisissez un abonnement pour tout rouvrir."}
            </p>
          </div>
          {paid && canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" loading={busy === "portal"} onClick={() => run("portal", openBillingPortal)}>Factures et carte</Button>
              {current.cancelAtPeriodEnd ? (
                <Button size="sm" loading={busy === "resume"} onClick={() => run("resume", resumePlan)}>Reprendre</Button>
              ) : (
                <Button variant="ghost" size="sm" loading={busy === "cancel"} onClick={() => run("cancel", cancelPlan)}>Résilier</Button>
              )}
            </div>
          ) : null}
        </div>
        {msg ? <p className={cn("border-t border-border px-5 py-3 text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </Card>

      {/* Forfaits */}
      <Card>
        <CardHeader title={paid ? "Changer d'abonnement" : "Choisir votre abonnement"} description="Un seul abonnement pour toutes les apps incluses. Sans engagement, résiliable en un clic. Un changement en cours de mois est calculé au prorata." />
        <div className="space-y-5 p-5">
          {!enabled ? <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">Le paiement n&apos;est pas encore configuré sur ce serveur (prix Stripe Skydev).</p> : null}
          <div className="inline-flex rounded-lg bg-surface-muted p-1" role="radiogroup" aria-label="Période">
            {(["month", "year"] as const).map((i) => (
              <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval_(i)} className={cn("h-9 rounded-md px-4 text-sm font-medium transition-colors", interval === i ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>
                {i === "month" ? "Mensuel" : "Annuel · 2 mois offerts"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(["pro", "pro_plus"] as const).map((p: PaidPlan) => {
              const def = SKYDEV_PLANS[p];
              const monthly = interval === "year" ? Math.round((def.yearly / 12) * 100) / 100 : def.monthly;
              const isCurrent = paid && current.plan === p && (current.interval ?? "month") === interval;
              const label = isCurrent ? "Votre abonnement" : paid ? (p === "pro_plus" && current.plan === "pro" ? "Passer à Équipe" : `Passer à ${def.label}`) : `Choisir ${def.label}`;
              return (
                <div key={p} className={cn("flex flex-col rounded-xl border p-5", isCurrent ? "border-accent ring-1 ring-accent" : p === "pro_plus" ? "border-border-strong" : "border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-semibold">{def.label}</p>
                    {isCurrent ? <Badge tone="accent">Actuel</Badge> : null}
                  </div>
                  <p className="text-sm text-muted">{def.tagline}</p>
                  <p className="mt-4">
                    <span className="text-3xl font-semibold tracking-tight">{eur(monthly)}</span>
                    <span className="text-sm text-muted"> TVAC / mois</span>
                  </p>
                  <p className="text-xs text-muted">{interval === "year" ? `Facturé ${eur(def.yearly)} TVAC par an · ` : ""}{excludingVat(monthly)} HTVA / mois</p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {def.features.map((f) => (
                      <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{f}</li>
                    ))}
                  </ul>
                  {canManage ? (
                    <Button className="mt-5 w-full" variant={isCurrent ? "secondary" : "primary"} disabled={isCurrent || !enabled} loading={busy === `plan-${p}`} onClick={() => run(`plan-${p}`, () => choosePlan({ plan: p, interval }))}>
                      {label}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!canManage ? <p className="text-sm text-muted">Seul le titulaire du compte peut gérer l&apos;abonnement.</p> : null}
        </div>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader title="Options" description="Elles s'ajoutent à votre abonnement, sur la même facture. Vous les retirez quand vous voulez." />
        <div className="divide-y divide-border">
          {lockedReason ? <p className="bg-surface-muted px-5 py-3 text-sm text-muted">{lockedReason}</p> : null}
          <AddonRow
            icon={<PhoneCall />}
            title={SKYDEV_ADDONS.tel_ia.label}
            price={`${eur(SKYDEV_ADDONS.tel_ia.monthly)} TVAC / mois`}
            text={SKYDEV_ADDONS.tel_ia.description}
            active={telIa}
            action={canManage ? <Button size="sm" variant={telIa ? "ghost" : "primary"} disabled={!paid} loading={busy === "tel"} onClick={() => run("tel", () => setModuleAddon("tel_ia", !telIa))}>{telIa ? "Retirer" : "Ajouter"}</Button> : null}
          />
          <AddonRow
            icon={<Globe />}
            title={SKYDEV_ADDONS.domain.label}
            price={`${eur(SKYDEV_ADDONS.domain.monthly)} TVAC / mois`}
            text={current.plan === "pro_plus" ? "Déjà inclus dans Équipe." : SKYDEV_ADDONS.domain.description}
            active={current.customUrlAddon || current.plan === "pro_plus"}
            action={canManage && current.plan !== "pro_plus" ? <Button size="sm" variant={current.customUrlAddon ? "ghost" : "secondary"} disabled={!paid} loading={busy === "domain"} onClick={() => run("domain", () => setCustomUrlAddon(!current.customUrlAddon))}>{current.customUrlAddon ? "Retirer" : "Ajouter"}</Button> : null}
          />
          <AddonRow
            icon={<UserPlus />}
            title={SKYDEV_ADDONS.seat.label}
            price={`${eur(SKYDEV_ADDONS.seat.monthly)} TVAC / mois par utilisateur`}
            text={SKYDEV_ADDONS.seat.description}
            active={current.extraSeats > 0}
            action={
              canManage ? (
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-border-strong">
                    <button type="button" className="flex size-9 items-center justify-center text-muted hover:text-text disabled:opacity-40" aria-label="Un utilisateur de moins" disabled={!paid || seats <= 0} onClick={() => setSeats((n) => Math.max(0, n - 1))}><Minus className="size-4" aria-hidden="true" /></button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{seats}</span>
                    <button type="button" className="flex size-9 items-center justify-center text-muted hover:text-text disabled:opacity-40" aria-label="Un utilisateur de plus" disabled={!paid || seats >= 50} onClick={() => setSeats((n) => Math.min(50, n + 1))}><Plus className="size-4" aria-hidden="true" /></button>
                  </div>
                  {seats !== current.extraSeats ? <Button size="sm" loading={busy === "seats"} onClick={() => run("seats", () => setExtraSeats(seats))}>Enregistrer</Button> : null}
                </div>
              ) : null
            }
          />
          <AddonRow icon={<MessageSquareText />} title="Rappels SMS" price="Packs de crédits" text="Des SMS en plus de ceux inclus dans votre abonnement, achetés quand vous en avez besoin." action={<ButtonLink href="/app/reglages/sms" size="sm" variant="secondary">Gérer les SMS</ButtonLink>} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-5" aria-hidden="true"><WandSparkles /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Besoin de plus ? Tout est possible sur mesure.</p>
          <p className="text-sm text-muted">Site unique, app mobile, logiciel métier, automatisation : prix fixe annoncé avant de commencer.</p>
        </div>
        <Link href="/app/sur-mesure" className="text-sm font-medium text-accent hover:text-accent-hover">Décrire mon projet</Link>
      </Card>
    </div>
  );
}

function AddonRow({ icon, title, price, text, active, action }: { icon: React.ReactNode; title: string; price: string; text: string; active?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-5" aria-hidden="true">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{title}</p>
          {active ? <Badge tone="success">Actif</Badge> : null}
          <span className="text-sm text-muted">{price}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{text}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
