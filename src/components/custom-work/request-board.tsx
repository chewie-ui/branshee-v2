"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { REQUEST_STATUS, clientCan, fmtEuros, type RequestStatus } from "@/lib/custom-work";
import { answerCustomRequest, submitCustomRequest } from "@/server/actions/custom-work";

type Req = { id: string; title: string; description: string; app: string | null; status: string; setupCents: number | null; monthlyCents: number | null; reply: string | null; createdAt: string };
type Res = { ok: boolean; message?: string; error?: string };
const TONE: Record<string, string> = { neutral: "bg-surface-muted text-muted", accent: "bg-accent-soft text-accent", warning: "bg-warning-soft text-warning", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger" };

/** Sur mesure : décrire une demande, suivre le prix et l'avancement. */
export function RequestBoard({ requests, apps, canRequest, features }: { requests: Req[]; apps: { id: string; name: string }[]; canRequest: boolean; features: { label: string; monthly: number }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ appId: "", title: "", description: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fmtDate = (iso: string) => new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium" }).format(new Date(iso));
  const run = (fn: () => Promise<Res>, after?: () => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      if (r.ok) after?.();
      router.refresh();
    });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sur mesure</h1>
        <p className="mt-1 max-w-2xl text-muted">Une modif dans une de vos apps (« dans RDV, je voudrais… »), un outil pour votre métier, une automatisation : décrivez-le. Vous recevez un prix fixe ; une fois accepté, on le construit rien que pour vous, dans vos apps.</p>
      </div>
      {msg ? <p className={cn("max-w-3xl rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {canRequest ? (
        <Card className="max-w-3xl">
          <CardHeader title="Nouvelle demande" />
          <form className="grid gap-4 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); run(() => submitCustomRequest(f), () => setF({ appId: "", title: "", description: "" })); }}>
            <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
              <Field label="Pour quelle app ?" htmlFor="cr-app">
                <Select id="cr-app" value={f.appId} onChange={(e) => setF({ ...f, appId: e.target.value })}>
                  <option value="">Nouvel outil</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="En une phrase" htmlFor="cr-title"><Input id="cr-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} placeholder="Ex. : un acompte différent selon la prestation" /></Field>
            </div>
            <Field label="Expliquez ce que vous voulez" htmlFor="cr-desc" hint="Comment vous travaillez aujourd'hui, ce qui vous fait perdre du temps, ce que vous aimeriez voir à l'écran."><Textarea id="cr-desc" rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={5000} /></Field>
            <div><Button type="submit" loading={pending} icon={<Send className="size-4" aria-hidden="true" />}>Envoyer la demande</Button></div>
          </form>
        </Card>
      ) : <p className="max-w-3xl rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted">Les demandes sur mesure sont faites par le responsable de l&apos;entreprise.</p>}

      {features.length ? (
        <Card className="max-w-3xl">
          <CardHeader title="Vos fonctionnalités sur mesure" />
          <ul className="divide-y divide-border text-sm">{features.map((x) => <li key={x.label} className="flex justify-between gap-3 px-5 py-3"><span className="inline-flex items-center gap-2"><Wand2 className="size-4 text-accent" aria-hidden="true" />{x.label}</span>{x.monthly ? <span className="tabular-nums text-muted">{fmtEuros(x.monthly)} / mois</span> : null}</li>)}</ul>
        </Card>
      ) : null}

      <section aria-labelledby="cr-list" className="max-w-3xl space-y-3">
        <h2 id="cr-list" className="text-lg font-semibold">Vos demandes</h2>
        {!requests.length ? <p className="text-sm text-muted">Aucune demande pour l&apos;instant.</p> : null}
        {requests.map((r) => {
          const st = REQUEST_STATUS[r.status as RequestStatus] ?? REQUEST_STATUS.new;
          const price = [r.setupCents ? `${fmtEuros(r.setupCents)} une fois` : null, r.monthlyCents ? `${fmtEuros(r.monthlyCents)} par mois en plus` : null].filter(Boolean).join(" + ");
          return (
            <Card key={r.id} className="space-y-2 p-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 font-medium">{r.title}</p>
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", TONE[st.tone])}>{st.label}</span>
              </div>
              <p className="text-muted">{r.app ? `${r.app} · ` : ""}demandée le {fmtDate(r.createdAt)}</p>
              <p className="line-clamp-3 whitespace-pre-line">{r.description}</p>
              {r.reply ? <p className="rounded-lg bg-surface-muted px-3 py-2 whitespace-pre-line"><b>Skydev :</b> {r.reply}</p> : null}
              {r.status === "quoted" && price ? <p className="font-medium">Prix proposé : {price}</p> : null}
              {canRequest ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {clientCan(r.status, "accept") ? <Button size="sm" disabled={pending} onClick={() => run(() => answerCustomRequest(r.id, "accept"))}>Accepter le prix</Button> : null}
                  {clientCan(r.status, "decline") ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => answerCustomRequest(r.id, "decline"))}>Refuser</Button> : null}
                  {clientCan(r.status, "cancel") ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => answerCustomRequest(r.id, "cancel"))}>Annuler la demande</Button> : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
