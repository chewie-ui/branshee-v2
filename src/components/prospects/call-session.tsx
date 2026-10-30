"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, FileText, Mail, MapPin, Phone, PhoneMissed, PhoneOff, SkipForward, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { OUTCOMES, REFUSE_REASONS, isOutcome, type Outcome } from "@/lib/prospects";
import { logCall, saveScript } from "@/server/actions/prospects";
import type { ProspectView } from "@/server/prospects";
import { statusBadge, telHref } from "./prospect-board";

type Res = { ok: boolean; message?: string; error?: string; dealId?: string };
type Hist = { id: string; outcome: string; note: string | null; at: string; who: string | null };

/** Demain à 10 h (heure locale du navigateur), au format du champ datetime-local. */
function tomorrowAt10() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

export function CallSession({ current, remaining, skipped, script, today, history, timezone }: { current: ProspectView | null; remaining: number; skipped: string[]; script: string; today: { calls: number; answered: number; interested: number }; history: Hist[]; timezone: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<null | "callback" | "refused">(null);
  const [when, setWhen] = useState(tomorrowAt10);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; dealId?: string } | null>(null);
  const [pending, start] = useTransition();
  const [scriptText, setScriptText] = useState(script);
  const [scriptEdit, setScriptEdit] = useState(!script);
  const [scriptSaved, setScriptSaved] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const reset = () => { setNote(""); setMode(null); setReason(""); setWhen(tomorrowAt10()); };
  const send = (outcome: Outcome) => {
    if (!current) return;
    start(async () => {
      const r: Res = await logCall({ id: current.id, outcome, note, callbackAt: outcome === "callback" ? new Date(when).toISOString() : "", reason: outcome === "refused" ? reason : "" }).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Noté.") : (r.error ?? "Action impossible."), dealId: r.dealId });
      if (r.ok) { reset(); router.refresh(); }
    });
  };
  const skip = () => {
    if (!current) return;
    reset();
    setMsg(null);
    router.push(`/app/ventes/prospection/appels?passer=${[...skipped.filter((x) => x !== current.id), current.id].join(",")}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/ventes/prospection" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Prospection</Link>
        <p className="text-sm text-muted" role="status">
          Aujourd&apos;hui : <span className="font-medium text-text tabular-nums">{today.calls}</span> appel{today.calls > 1 ? "s" : ""} · <span className="font-medium text-text tabular-nums">{today.answered}</span> joint{today.answered > 1 ? "s" : ""} · <span className="font-medium text-success tabular-nums">{today.interested}</span> intéressé{today.interested > 1 ? "s" : ""}
        </p>
      </div>

      {msg ? (
        <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>
          {msg.text}
          {msg.dealId ? <> <Link href={`/app/ventes?piste=${msg.dealId}`} className="font-medium underline">Ouvrir la piste</Link></> : null}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {current ? (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">{remaining} à appeler</p>
                <h1 className="mt-1 text-2xl font-semibold">{current.company || current.name}</h1>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                  {current.company && current.name !== current.company ? <span>{current.name}</span> : null}
                  {current.trade ? <span>{current.trade}</span> : null}
                  {current.city ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{current.city}</span> : null}
                </p>
              </div>
              {statusBadge(current)}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {current.phone ? (
                <a href={telHref(current.phone)} className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-lg font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <Phone className="size-5" aria-hidden="true" />{current.phone}
                </a>
              ) : null}
              {current.email ? <a href={`mailto:${current.email}`} className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted"><Mail className="size-4" aria-hidden="true" />{current.email}</a> : null}
            </div>

            {current.status === "callback" && current.callbackAt ? <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">Rappel promis pour le {fmt.format(new Date(current.callbackAt))}.</p> : null}
            {current.note ? <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-muted px-3 py-2 text-sm">{current.note}</p> : null}

            <Field label="Note de l'appel (facultatif)" htmlFor="call-note" className="mt-5">
              <Textarea id="call-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Ce qu'il a dit, le nom du décideur, ce qu'il utilise aujourd'hui…" />
            </Field>

            <p className="mt-5 mb-2 text-sm font-medium">Résultat de l&apos;appel</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button variant="secondary" disabled={pending} icon={<PhoneMissed className="size-4" aria-hidden="true" />} onClick={() => send("no_answer")}>Pas de réponse</Button>
              <Button variant="secondary" disabled={pending} aria-pressed={mode === "callback"} icon={<CalendarClock className="size-4" aria-hidden="true" />} onClick={() => setMode(mode === "callback" ? null : "callback")}>À rappeler</Button>
              <Button disabled={pending} icon={<ThumbsUp className="size-4" aria-hidden="true" />} onClick={() => send("interested")}>Intéressé</Button>
              <Button variant="secondary" disabled={pending} aria-pressed={mode === "refused"} icon={<ThumbsDown className="size-4" aria-hidden="true" />} onClick={() => setMode(mode === "refused" ? null : "refused")}>Pas intéressé</Button>
              <Button variant="ghost" disabled={pending} icon={<PhoneOff className="size-4" aria-hidden="true" />} onClick={() => send("invalid")}>Mauvais numéro</Button>
              <Button variant="ghost" disabled={pending} icon={<SkipForward className="size-4" aria-hidden="true" />} onClick={skip}>Passer</Button>
            </div>

            {mode === "callback" ? (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
                <Field label="Rappeler le" htmlFor="call-when"><Input id="call-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
                <Button loading={pending} icon={<Check className="size-4" aria-hidden="true" />} onClick={() => send("callback")}>Noter le rappel</Button>
              </div>
            ) : null}
            {mode === "refused" ? (
              <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Pourquoi ? (facultatif)</p>
                <div className="flex flex-wrap gap-2">
                  {REFUSE_REASONS.map((r) => (
                    <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? "" : r)} className={cn("h-9 rounded-full border px-3 text-sm transition-colors", reason === r ? "border-danger bg-danger-soft font-medium text-danger" : "border-border text-muted hover:border-border-strong hover:text-text")}>{r}</button>
                  ))}
                </div>
                <Input aria-label="Autre raison" value={REFUSE_REASONS.includes(reason as never) ? "" : reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Autre raison…" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" loading={pending} onClick={() => send("refused")}>Noter le refus</Button>
                  <Button variant="ghost" disabled={pending} onClick={() => send("do_not_call")}>Ne plus jamais appeler</Button>
                </div>
              </div>
            ) : null}

            {history.length ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-medium">Appels précédents</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap gap-x-2 text-muted">
                      <span className="tabular-nums">{fmt.format(new Date(h.at))}</span>
                      <span className="font-medium text-text">{isOutcome(h.outcome) ? OUTCOMES[h.outcome].label : h.outcome}</span>
                      {h.note ? <span>· {h.note}</span> : null}
                      {h.who ? <span>· {h.who}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : (
          <Card className="p-10 text-center">
            <Check className="mx-auto size-10 text-success" aria-hidden="true" />
            <h1 className="mt-3 text-xl font-semibold">Personne à appeler pour l&apos;instant</h1>
            <p className="mt-1 text-sm text-muted">Les rappels promis et ceux qui n&apos;ont pas répondu reviendront ici au bon moment. Ajoutez des prospects pour continuer.</p>
            <Link href="/app/ventes/prospection" className="mt-5 inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted">Retour à la liste</Link>
          </Card>
        )}

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader title="Votre script" description="Ce que vous dites au téléphone, toujours sous les yeux." action={!scriptEdit ? <Button size="sm" variant="ghost" icon={<FileText className="size-4" aria-hidden="true" />} onClick={() => setScriptEdit(true)}>Modifier</Button> : undefined} />
          <div className="px-5 pb-5">
            {scriptEdit ? (
              <div className="space-y-2">
                <Textarea aria-label="Script d'appel" rows={12} value={scriptText} onChange={(e) => { setScriptText(e.target.value); setScriptSaved(null); }} maxLength={8000} placeholder={"Bonjour, je suis … de …\nJe vous appelle parce que …\nEst-ce que vous avez 2 minutes ?\n\nSi « déjà équipé » : …\nSi « trop cher » : …"} />
                <div className="flex items-center gap-2">
                  <Button size="sm" loading={pending} onClick={() => start(async () => { const r: Res = await saveScript(scriptText).catch(() => ({ ok: false, error: "Enregistrement impossible." })); setScriptSaved(r.ok ? "Enregistré." : (r.error ?? "Enregistrement impossible.")); if (r.ok && scriptText.trim()) setScriptEdit(false); })}>Enregistrer</Button>
                  {scriptSaved ? <span className="text-sm text-muted" role="status">{scriptSaved}</span> : null}
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-line text-sm leading-relaxed">{scriptText}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
