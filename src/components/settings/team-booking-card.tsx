"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { TEAM_CHOICES, memberSlug, type TeamChoice } from "@/lib/team-booking";
import { saveTeamBooking } from "@/server/actions/team-booking";

type Person = { id: string; name: string; photoUrl: string | null; role: string | null; bookable: boolean; services: number };

/** Réglages › Réservation : qui prend des rendez-vous, choix du praticien, page commune et pages par personne. */
export function TeamBookingCard({ team, choice, pageUrl }: { team: Person[]; choice: TeamChoice; pageUrl: string }) {
  const [on, setOn] = useState<Set<string>>(new Set(team.filter((p) => p.bookable).map((p) => p.id)));
  const [c, setC] = useState<TeamChoice>(choice);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = team.filter((p) => p.bookable);
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500); } catch { /* presse-papiers indisponible */ }
  };
  const flip = (id: string) => { const n = new Set(on); if (n.has(id)) n.delete(id); else n.add(id); setOn(n); setMsg(null); };

  return (
    <Card>
      <CardHeader title="Équipe et rendez-vous" description="Choisissez qui prend des rendez-vous en ligne, et comment le client choisit." />
      <form
        className="space-y-6 p-5"
        onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveTeamBooking({ teamChoice: c, bookable: [...on] }); setMsg(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: r.error }); }); }}
      >
        <fieldset>
          <legend className="text-sm font-semibold">Qui prend des rendez-vous ?</legend>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {team.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <Avatar name={p.name} src={p.photoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    {on.has(p.id) && !p.services ? <span className="block text-sm text-warning">Aucune prestation : <Link href="/app/prestations" className="font-medium underline">choisir ses prestations</Link></span> : <span className="block truncate text-sm text-muted">{p.services} prestation{p.services > 1 ? "s" : ""}{p.role ? ` · ${p.role}` : ""}</span>}
                  </span>
                  <input type="checkbox" checked={on.has(p.id)} onChange={() => flip(p.id)} className="size-5 accent-[var(--accent)]" aria-label={`${p.name} prend des rendez-vous`} />
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Les personnes décochées ne sont plus proposées aux clients. Leurs rendez-vous déjà pris restent dans l&apos;agenda, et elles gardent leur accès aux autres apps.</p>
        </fieldset>

        {team.length > 1 ? (
          <fieldset>
            <legend className="text-sm font-semibold">Sur la page commune, le client…</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(Object.keys(TEAM_CHOICES) as TeamChoice[]).map((k) => (
                <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150", c === k ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong")}>
                  <input type="radio" name="teamChoice" checked={c === k} onChange={() => { setC(k); setMsg(null); }} className="mt-1 size-4 accent-[var(--accent)]" />
                  <span><span className="block font-medium">{TEAM_CHOICES[k].label}</span><span className="block text-sm text-muted">{TEAM_CHOICES[k].desc}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
        <Button type="submit" loading={pending}>Enregistrer</Button>
      </form>

      {saved.length > 1 ? (
        <section className="border-t border-border p-5" aria-labelledby="pages-perso">
          <h3 id="pages-perso" className="text-sm font-semibold">Une page par personne</h3>
          <p className="mt-1 text-sm text-muted">À donner à vos clients habituels, ou à mettre sur la carte de visite de chacun : le client réserve directement avec cette personne.</p>
          <ul className="mt-3 space-y-2">
            {[{ id: "all", name: "Page commune (toute l'équipe)", url: pageUrl, photoUrl: null as string | null }, ...saved.map((p) => ({ id: p.id, name: p.name, url: `${pageUrl}?avec=${memberSlug(p, saved)}`, photoUrl: p.photoUrl }))].map((x) => (
              <li key={x.id} className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-muted px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.name}</span><span className="block truncate text-xs text-muted">{x.url.replace(/^https?:\/\//, "")}</span></span>
                <button type="button" onClick={() => copy(x.url)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text" aria-label={`Copier le lien de ${x.name}`} title="Copier le lien">
                  {copied === x.url ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                </button>
                <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text" aria-label={`Ouvrir la page de ${x.name}`} title="Ouvrir"><ExternalLink className="size-4" aria-hidden="true" /></a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}
