"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Globe, MessageSquareText, Minus, PhoneCall, Plus, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { eur, excludingVat, type Plan } from "@/lib/plans";
import { SKYDEV_ADDONS, SKYDEV_FEATURES, SKYDEV_NAME, USER_TIERS, skydevPrice, tierLabels, userPrice } from "@/lib/skydev-plans";
import { cancelPlan, choosePlan, openBillingPortal, resumePlan, setCustomUrlAddon, setModuleAddon } from "@/server/actions/billing";

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
  /** Utilisateurs facturés sur l'abonnement Skydev (null = pas d'abonnement par utilisateur). */
  billedUsers: number | null;
};
type R = { ok: true; message?: string; url?: string } | { ok: false; error: string };

const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "");
const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

/**
 * Abonnement Skydev : un seul abonnement pour toutes les apps, payé par utilisateur (prix dégressif), et des options
 * sur le même abonnement. `teamUsers` = personnes de l'équipe aujourd'hui (base de l'abonnement).
 */
export function SkydevBillingPanel({ current, enabled, canManage, teamUsers }: { current: SkydevCurrent; enabled: boolean; canManage: boolean; teamUsers: number }) {
  const [interval, setInterval_] = useState<"month" | "year">(current.interval ?? "month");
  const [users, setUsers] = useState(teamUsers);
  const price = skydevPrice(users);
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
  const planName = current.plan === "free" ? null : SKYDEV_NAME;
  const isCurrent = paid && current.billedUsers != null && (current.interval ?? "month") === interval;
  const telIa = current.modules.includes("tel_ia");
  const lockedReason = !paid ? "Les options s'ajoutent à votre abonnement : abonnez-vous d'abord." : null;

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
                      : `${current.billedUsers ? `${current.billedUsers} utilisateur${current.billedUsers > 1 ? "s" : ""} · ${eur(skydevPrice(current.billedUsers)[current.interval === "year" ? "yearly" : "monthly"])} TVAC ${current.interval === "year" ? "par an" : "par mois"}` : current.interval === "year" ? "Annuel" : "Mensuel"}${current.periodEnd ? `, prochain renouvellement le ${fmtDate(current.periodEnd)}` : ""}.`
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

      {/* Abonnement unique, prix par utilisateur dégressif */}
      <Card>
        <CardHeader
          title={paid ? "Votre tarif" : "Un abonnement pour toutes les apps"}
          description="Vous payez par personne de l'équipe, et chaque personne ajoutée coûte moins cher que la précédente. Sans engagement, résiliable en un clic."
        />
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_minmax(0,320px)]">
          <div className="space-y-5">
            {!enabled ? <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">Le paiement n&apos;est pas encore configuré sur ce serveur (prix Stripe Skydev).</p> : null}
            <div className="inline-flex rounded-lg bg-surface-muted p-1" role="radiogroup" aria-label="Période">
              {(["month", "year"] as const).map((i) => (
                <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval_(i)} className={cn("h-9 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent", interval === i ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>
                  {i === "month" ? "Mensuel" : "Annuel · 2 mois offerts"}
                </button>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium" id="users-label">Calculer le prix pour</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-lg border border-border-strong" role="group" aria-labelledby="users-label">
                  <button type="button" className="flex size-11 items-center justify-center text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40" aria-label="Une personne de moins" disabled={users <= 1} onClick={() => setUsers((n) => Math.max(1, n - 1))}><Minus className="size-4" aria-hidden="true" /></button>
                  <span className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">{users}</span>
                  <button type="button" className="flex size-11 items-center justify-center text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40" aria-label="Une personne de plus" disabled={users >= 50} onClick={() => setUsers((n) => Math.min(50, n + 1))}><Plus className="size-4" aria-hidden="true" /></button>
                </div>
                {users !== teamUsers ? (
                  <span className="text-sm text-muted">Simulation. Vous payez pour les {teamUsers} personne{teamUsers > 1 ? "s" : ""} de votre équipe ; le prix suit quand vous en ajoutez dans Équipe. <button type="button" className="font-medium text-accent hover:text-accent-hover" onClick={() => setUsers(teamUsers)}>Revenir à {teamUsers}</button></span>
                ) : (
                  <span className="text-sm text-muted">{teamUsers === 1 ? "Vous seul pour l'instant" : `Votre équipe actuelle`}</span>
                )}
              </div>
            </div>

            <ol className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {tierLabels().map((t, i) => {
                const used = i < USER_TIERS.length - 1 ? users > i : users >= USER_TIERS.length;
                const count = i < USER_TIERS.length - 1 ? (users > i ? 1 : 0) : Math.max(0, users - (USER_TIERS.length - 1));
                return (
                  <li key={t.label} className={cn("rounded-lg border px-3 py-2", used ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted")}>
                    <span className="block text-xs">{t.label}</span>
                    <span className="font-semibold tabular-nums">{eur(t.price)}</span>
                    {i === USER_TIERS.length - 1 && count > 1 ? <span className="text-xs"> × {count}</span> : null}
                  </li>
                );
              })}
            </ol>
            <ul className="space-y-2 text-sm">
              {SKYDEV_FEATURES.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{f}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col rounded-xl border border-border-strong p-5">
            <p className="text-sm text-muted">{price.users} utilisateur{price.users > 1 ? "s" : ""}</p>
            <p className="mt-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{eur(interval === "year" ? price.yearly / 12 : price.monthly)}</span>
              <span className="text-sm text-muted"> TVAC / mois</span>
            </p>
            <p className="text-xs text-muted">
              {interval === "year" ? `Facturé ${eur(price.yearly)} TVAC par an · ` : ""}
              {excludingVat(interval === "year" ? price.yearly / 12 : price.monthly)} HTVA / mois
            </p>
            {price.users > 1 ? <p className="mt-2 text-sm text-muted">Soit {eur(price.perUser)} par personne en moyenne.</p> : null}
            <p className="mt-3 text-sm text-muted">
              Prochaine personne ajoutée : <span className="font-medium text-text">{eur(userPrice(price.users + 1))} / mois</span>.
            </p>
            <div className="mt-auto pt-5">
              {canManage ? (
                <Button className="w-full" variant={isCurrent ? "secondary" : "primary"} disabled={isCurrent || !enabled} loading={busy === "plan"} onClick={() => run("plan", () => choosePlan({ plan: "pro_plus", interval }))}>
                  {isCurrent ? "Votre abonnement" : paid ? (interval === "year" ? "Passer à l'annuel" : "Passer au mensuel") : `S'abonner pour ${teamUsers} utilisateur${teamUsers > 1 ? "s" : ""}`}
                </Button>
              ) : (
                <p className="text-sm text-muted">Seul le titulaire du compte peut gérer l&apos;abonnement.</p>
              )}
              <p className="mt-3 text-xs text-muted">
                {paid
                  ? "Quand vous ajoutez ou retirez quelqu'un dans Équipe, l'abonnement s'adapte tout seul, au prorata."
                  : `L'abonnement se base sur votre équipe actuelle (${teamUsers} personne${teamUsers > 1 ? "s" : ""}). Ensuite, il suit les ajouts et retraits dans Équipe, au prorata.`}
              </p>
            </div>
          </div>
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
            text={SKYDEV_ADDONS.domain.description}
            active={current.customUrlAddon}
            action={canManage ? <Button size="sm" variant={current.customUrlAddon ? "ghost" : "secondary"} disabled={!paid} loading={busy === "domain"} onClick={() => run("domain", () => setCustomUrlAddon(!current.customUrlAddon))}>{current.customUrlAddon ? "Retirer" : "Ajouter"}</Button> : null}
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
