"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { countAudience, deleteCampaign, saveCampaign, sendCampaign, stopCampaign, testCampaign } from "@/server/actions/marketing";

type Audience = { type: "all" | "recent" | "inactive"; days: number };
type Initial = { id: string; subject: string; body: string; audience: Audience; status: string; recipients: number };
type Stats = { sent: number; pending: number; failed: number; unsub: number };
type Res = { ok: boolean; message?: string; error?: string; id?: string; count?: number };

const IDEAS = [
  { label: "Nouveauté", subject: "Du nouveau chez nous", body: "Bonjour {prenom},\n\nNous avons une nouveauté à vous annoncer : …\n\nÀ très bientôt !" },
  { label: "Congés", subject: "Nos dates de fermeture", body: "Bonjour {prenom},\n\nNous serons fermés du … au …. Pensez à réserver avant !\n\nBonne journée." },
  { label: "On ne vous a pas vu", subject: "Ça fait longtemps !", body: "Bonjour {prenom},\n\nCela fait un moment que nous ne vous avons pas vu. Envie de reprendre rendez-vous ?\n\nAu plaisir de vous revoir." },
];

/** Écrire, tester et envoyer une campagne ; suivre l'envoi. */
export function CampaignEditor({ initial, stats, initialCount }: { initial: Initial | null; stats: Stats | null; initialCount: number }) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? null);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? { type: "all", days: 180 });
  const [count, setCount] = useState(initialCount);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"send" | "delete" | "stop" | null>(null);
  const [pending, start] = useTransition();
  const draft = !initial || initial.status === "draft";

  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => { countAudience(audience).then((r: Res) => r.ok && setCount(r.count ?? 0), () => {}); }, 300);
    return () => clearTimeout(t);
  }, [audience, draft]);

  const save = async () => {
    const r: Res = await saveCampaign({ id: id ?? undefined, subject, body, audience }).catch(() => ({ ok: false, error: "Enregistrement impossible." }));
    if (r.ok && r.id && !id) setId(r.id);
    return r;
  };
  const act = (fn: () => Promise<Res>, after?: () => void) => start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") }); if (r.ok) after?.(); router.refresh(); });

  return (
    <div className="space-y-4">
      <Link href="/app/marketing" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Campagnes</Link>
      <h1 className="text-2xl font-semibold">{draft ? (initial ? "Modifier la campagne" : "Nouvelle campagne") : initial.subject}</h1>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Envoyés", stats.sent], ["En attente", stats.pending], ["Échecs", stats.failed], ["Désabonnements", stats.unsub]].map(([l, v]) => <Card key={l} className="p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></Card>)}
        </div>
      ) : null}
      {initial?.status === "sending" ? <Button variant="secondary" onClick={() => setConfirm("stop")}>Arrêter l&apos;envoi</Button> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-4 p-5">
          {draft ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted">Idées :</span>
              {IDEAS.map((i) => <button key={i.label} type="button" onClick={() => { setSubject(i.subject); setBody(i.body); }} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent">{i.label}</button>)}
            </div>
          ) : null}
          <Field label="Objet" htmlFor="mk-subject"><Input id="mk-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} disabled={!draft} /></Field>
          <Field label="Message" htmlFor="mk-body" hint="{prenom} est remplacé par le prénom de chaque client."><Textarea id="mk-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} disabled={!draft} /></Field>
          {draft ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">À qui</legend>
              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <Select aria-label="Audience" value={audience.type} onChange={(e) => setAudience({ ...audience, type: e.target.value as Audience["type"] })}>
                  <option value="all">Tous les clients</option>
                  <option value="recent">Clients venus récemment</option>
                  <option value="inactive">Clients pas revus depuis…</option>
                </Select>
                {audience.type !== "all" ? <Select aria-label="Période" value={audience.days} onChange={(e) => setAudience({ ...audience, days: Number(e.target.value) })}>{[[30, "1 mois"], [90, "3 mois"], [180, "6 mois"], [365, "1 an"]].map(([d, l]) => <option key={d} value={d}>{audience.type === "recent" ? `ces ${l}` : l}</option>)}</Select> : null}
              </div>
              <p className="text-sm"><span className="font-semibold tabular-nums">{count}</span> client{count > 1 ? "s" : ""} avec un email (désabonnés exclus)</p>
            </fieldset>
          ) : null}
          {draft ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="secondary" loading={pending} onClick={() => act(save)}>Enregistrer</Button>
              <Button variant="secondary" disabled={pending} onClick={() => act(async () => { const r = await save(); return r.ok && r.id ? testCampaign(r.id) : r; })}>M&apos;envoyer un test</Button>
              <Button disabled={pending || !count} icon={<Send className="size-4" aria-hidden="true" />} onClick={() => setConfirm("send")}>Envoyer</Button>
              {id ? <Button variant="ghost" className="ml-auto text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm("delete")}>Supprimer</Button> : null}
            </div>
          ) : null}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Aperçu" />
          <div className="space-y-3 px-5 pb-5 text-sm">
            <p className="font-semibold">{subject || "Objet de votre email"}</p>
            <p className="whitespace-pre-line text-muted">{(body || "Votre message…").replaceAll("{prenom}", "Marie")}</p>
            <p className="border-t border-border pt-3 text-xs text-muted">En bas de chaque email : un lien « Se désabonner ». Les clients désabonnés ne reçoivent plus vos campagnes (mais toujours leurs rappels de rendez-vous et factures).</p>
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === "send" ? `Envoyer à ${count} client${count > 1 ? "s" : ""} ?` : confirm === "stop" ? "Arrêter l'envoi ?" : "Supprimer ce brouillon ?"}
        confirmLabel={confirm === "send" ? "Envoyer" : confirm === "stop" ? "Arrêter" : "Supprimer"}
        danger={confirm !== "send"}
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          if (which === "send") act(async () => { const r = await save(); return r.ok && r.id ? sendCampaign(r.id) : r; });
          else if (which === "stop" && id) act(() => stopCampaign(id));
          else if (which === "delete" && id) act(() => deleteCampaign(id), () => router.push("/app/marketing"));
        }}
      >
        {confirm === "send" ? "Une fois parti, un email ne peut plus être rappelé. Envoyez-vous d'abord un test." : confirm === "stop" ? "Les emails déjà partis restent envoyés ; les autres sont annulés." : "Le brouillon est supprimé."}
      </ConfirmDialog>
    </div>
  );
}
