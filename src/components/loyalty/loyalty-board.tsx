"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, Link2, QrCode, Search, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { addStamp, saveLoyaltySettings, redeemReward } from "@/server/actions/loyalty";
import { useT } from "@/components/app-locale";
import { intlLocale } from "@/lib/i18n/app";

type CardRow = { id: string; stamps: number; rewards: number; last: string | null; customerId: string; name: string; email: string | null; url: string };
type Client = { id: string; name: string; email: string | null; phone: string | null };
type Res = { ok: boolean; message?: string; error?: string; reward?: boolean };

/** Tampon en deux gestes : chercher le client, « + 1 tampon ». Récompense quand l'objectif est atteint. */
type Settings = { goal: number; reward: string; autoAppointment: boolean; autoShop: boolean; qrEnabled: boolean };

export function LoyaltyBoard({ settings, cards, clients, canManage }: { settings: Settings; cards: CardRow[]; clients: Client[]; canManage: boolean }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; reward?: boolean } | null>(null);
  const [goal, setGoal] = useState(String(settings.goal));
  const [reward, setReward] = useState(settings.reward);
  const [autoAppointment, setAutoAppointment] = useState(settings.autoAppointment);
  const [autoShop, setAutoShop] = useState(settings.autoShop);
  const [qrEnabled, setQrEnabled] = useState(settings.qrEnabled);
  const [pending, start] = useTransition();
  const byCustomer = new Map(cards.map((c) => [c.customerId, c]));
  const ql = q.trim().toLowerCase();
  const found = ql.length >= 2 ? clients.filter((c) => c.name.toLowerCase().includes(ql) || c.email?.toLowerCase().includes(ql) || c.phone?.replace(/\s/g, "").includes(ql.replace(/\s/g, ""))).slice(0, 8) : [];
  const run = (fn: () => Promise<Res>) => start(async () => { const r: Res = await fn().catch(() => ({ ok: false, error: t("Action impossible.") })); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("Fait.")) : (r.error ?? t("Action impossible.")), reward: r.reward }); router.refresh(); });
  const ready = cards.filter((c) => c.stamps >= settings.goal);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        {settings.qrEnabled ? (
          <Link href="/app/fidelite/qr" className="flex items-center gap-4 rounded-xl border border-accent/20 bg-accent-soft p-4 transition-colors duration-150 hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><QrCode className="size-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-accent-soft-foreground">{t("Afficher le QR code à scanner")}</span><span className="block text-sm text-accent-soft-foreground/80">{t("Votre client le scanne avec son téléphone : il reçoit son tampon et voit sa carte.")}</span></span>
          </Link>
        ) : null}
        <Card className="p-5">
          <label htmlFor="ly-q" className="text-sm font-medium">{t("Donner un tampon à la main")}</label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="ly-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Nom, email ou téléphone du client")} className="pl-9" autoComplete="off" />
          </div>
          {found.length ? (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {found.map((c) => {
                const card = byCustomer.get(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.name}</span><span className="block text-xs text-muted">{card ? `${card.stamps}/${settings.goal} tampons` : t("Pas encore de carte")}</span></span>
                    <Button size="sm" loading={pending} icon={<Stamp className="size-4" aria-hidden="true" />} onClick={() => run(() => addStamp(c.id))}>{t("+ 1 tampon")}</Button>
                  </li>
                );
              })}
            </ul>
          ) : ql.length >= 2 ? <p className="mt-2 text-sm text-muted">{t("Aucun client trouvé. Ajoutez-le d'abord dans Clients.")}</p> : null}
          {msg ? <p className={cn("mt-3 rounded-lg px-3 py-2 text-sm", msg.reward ? "bg-warning-soft font-medium text-warning" : msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.reward ? <Gift className="mr-1.5 inline size-4" aria-hidden="true" /> : null}{msg.text}</p> : null}
        </Card>

        {ready.length ? (
          <Card className="border-warning">
            <CardHeader title={t("Récompenses à offrir")} description={settings.reward} />
            <ul className="divide-y divide-border">
              {ready.map((c) => <li key={c.id} className="flex items-center gap-3 px-5 py-2.5"><span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span><Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => redeemReward(c.id))}>{t("Récompense utilisée")}</Button></li>)}
            </ul>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 font-semibold">Cartes <span className="font-normal text-muted">· {cards.length}</span></h2>
          {cards.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">{t("Aucune carte pour l'instant : elle se crée au premier tampon (le client la reçoit par email s'il en a un).")}</p> : (
            <ul className="divide-y divide-border">
              {cards.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.name}</span><span className="block text-xs text-muted">{c.rewards ? `${c.rewards} récompense${c.rewards > 1 ? "s" : ""} · ` : ""}{c.last ? `dernier passage le ${new Intl.DateTimeFormat(intlLocale(t.locale), { day: "numeric", month: "short" }).format(new Date(c.last))}` : ""}</span></span>
                  <span className="flex gap-0.5" aria-label={`${c.stamps} tampons sur ${settings.goal}`}>{Array.from({ length: settings.goal }, (_, i) => <span key={i} className={cn("size-2.5 rounded-full", i < c.stamps ? "bg-accent" : "bg-surface-muted")} />)}</span>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(c.url).then(() => setMsg({ ok: true, text: `Lien de la carte de ${c.name} copié.` }), () => {})} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Copier le lien de la carte de ${c.name}`}><Link2 className="size-4" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="h-fit p-5">
        <h2 className="font-semibold">{t("Votre programme")}</h2>
        <p className="mt-1 text-sm text-muted">{settings.goal} tampons = {settings.reward}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {settings.qrEnabled ? <li>{t("Tampon par QR code activé")}</li> : null}
          {settings.autoAppointment ? <li>{t("Tampon automatique après chaque rendez-vous honoré")}</li> : null}
          {settings.autoShop ? <li>{t("Tampon automatique après chaque achat en ligne")}</li> : null}
        </ul>
        {canManage ? (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveLoyaltySettings({ goal: Number(goal), reward, autoAppointment, autoShop, qrEnabled })); }}>
            <Field label={t("Nombre de tampons")} htmlFor="ly-goal"><Input id="ly-goal" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Récompense" htmlFor="ly-reward"><Input id="ly-reward" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={120} placeholder={t("Ex. une séance offerte, -20 %, un café")} /></Field>
            <fieldset className="space-y-2 pt-1">
              <legend className="mb-1 text-sm font-medium">{t("Donner des tampons")}</legend>
              {[
                { id: "ly-qr", on: qrEnabled, set: setQrEnabled, label: t("Par QR code"), hint: t("Le client scanne un QR code sur votre écran.") },
                { id: "ly-appt", on: autoAppointment, set: setAutoAppointment, label: t("Après chaque rendez-vous"), hint: t("Automatique, sauf si vous marquez une absence.") },
                { id: "ly-shop", on: autoShop, set: setAutoShop, label: t("Après chaque achat en ligne"), hint: t("Commandes payées sur votre boutique.") },
              ].map((o) => (
                <label key={o.id} htmlFor={o.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 hover:bg-surface-muted">
                  <input id={o.id} type="checkbox" checked={o.on} onChange={(e) => o.set(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
                  <span className="min-w-0"><span className="block text-sm">{t(o.label)}</span><span className="block text-xs text-muted">{t(o.hint)}</span></span>
                </label>
              ))}
              <p className="text-xs text-muted">{t("Un seul tampon automatique ou scanné par jour et par client.")}</p>
            </fieldset>
            <Button type="submit" size="sm" loading={pending}>{t("Enregistrer")}</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
