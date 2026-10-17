"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveFaq, saveFormQuestions } from "@/server/actions/booking-page";

type Q = { key: string; label: string; type: "text" | "choice" | "yes_no"; isRequired: boolean; options: string[] };
let seq = 0;
const key = () => `q${++seq}`;

export function SaveBar({ dirty, pending, status, onSave, onReset }: { dirty: boolean; pending: boolean; status: { ok: boolean; msg: string } | null; onSave: () => void; onReset: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
      {status ? <p className={cn("text-sm sm:mr-auto", status.ok ? "text-success" : "text-danger")} role={status.ok ? "status" : "alert"}>{status.msg}</p> : null}
      {dirty ? <Button variant="ghost" onClick={onReset} disabled={pending}>Annuler</Button> : null}
      <Button onClick={onSave} loading={pending} disabled={!dirty}>Enregistrer</Button>
    </div>
  );
}

export function FormQuestionsEditor({ initial }: { initial: Omit<Q, "key">[] }) {
  const start0 = initial.map((q) => ({ ...q, key: key() }));
  const [saved, setSaved] = useState(start0);
  const [list, setList] = useState(start0);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const toPayload = (l: Q[]) => l.map((q) => ({ label: q.label, type: q.type, isRequired: q.isRequired, options: q.options }));
  const strip = (l: Q[]) => JSON.stringify(toPayload(l));
  const dirty = strip(list) !== strip(saved);
  const update = (i: number, patch: Partial<Q>) => {
    setStatus(null);
    setList((l) => l.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  };
  const move = (i: number, d: -1 | 1) => setList((l) => {
    const c = [...l];
    [c[i], c[i + d]] = [c[i + d]!, c[i]!];
    return c;
  });

  return (
    <Card>
      <CardHeader title="Questions avant la réservation" description="Posées au client à la dernière étape. Les réponses apparaissent sur le rendez-vous." />
      <div className="space-y-4 p-5">
        {list.length === 0 ? <p className="text-sm text-muted">Aucune question : le client donne seulement ses coordonnées.</p> : null}
        {list.map((q, i) => (
          <div key={q.key} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-start gap-2">
              <Field label={`Question ${i + 1}`} htmlFor={`${q.key}-label`} className="flex-1">
                <Input id={`${q.key}-label`} value={q.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={200} placeholder="Avez-vous une prescription médicale ?" />
              </Field>
              <div className="flex pt-7">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Monter"><ArrowUp className="size-4" aria-hidden="true" /></button>
                <button type="button" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Descendre"><ArrowDown className="size-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer la question ${i + 1}`}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Type de réponse" htmlFor={`${q.key}-type`} className="w-56">
                <Select id={`${q.key}-type`} value={q.type} onChange={(e) => update(i, { type: e.target.value as Q["type"], options: e.target.value === "choice" && q.options.length < 2 ? ["", ""] : q.options })}>
                  <option value="text">Texte libre</option>
                  <option value="yes_no">Oui / Non</option>
                  <option value="choice">Choix dans une liste</option>
                </Select>
              </Field>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={q.isRequired} onChange={(e) => update(i, { isRequired: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                Réponse obligatoire
              </label>
            </div>
            {q.type === "choice" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Choix proposés</p>
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex gap-2">
                    <Input value={o} onChange={(e) => update(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} aria-label={`Choix ${oi + 1}`} maxLength={80} />
                    <button type="button" onClick={() => update(i, { options: q.options.filter((_, k) => k !== oi) })} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Retirer le choix ${oi + 1}`}><X className="size-4" aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" disabled={q.options.length >= 12} onClick={() => update(i, { options: [...q.options, ""] })} className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50">+ Ajouter un choix</button>
              </div>
            ) : null}
          </div>
        ))}
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} disabled={list.length >= 10} onClick={() => setList((l) => [...l, { key: key(), label: "", type: "text", isRequired: false, options: [] }])}>
          Ajouter une question
        </Button>
      </div>
      <SaveBar
        dirty={dirty}
        pending={pending}
        status={status}
        onReset={() => { setList(saved); setStatus(null); }}
        onSave={() =>
          start(async () => {
            const payload = toPayload(list).map((q) => ({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) }));
            const res = await saveFormQuestions(payload);
            if (res.ok) { setSaved(list); setStatus({ ok: true, msg: "Questions enregistrées." }); }
            else setStatus({ ok: false, msg: res.error });
          })
        }
      />
    </Card>
  );
}

export function FaqEditor({ initial }: { initial: { question: string; answer: string }[] }) {
  const [saved, setSaved] = useState(initial);
  const [faq, setFaq] = useState(initial);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const dirty = JSON.stringify(faq) !== JSON.stringify(saved);

  return (
    <Card>
      <CardHeader title="Questions fréquentes" description="Parking, accès, ce qu'il faut apporter… Affichées sur votre page si la section « FAQ » est visible." />
      <div className="space-y-3 p-5">
        {faq.length === 0 ? <p className="text-sm text-muted">Aucune question fréquente pour l&apos;instant.</p> : null}
        {faq.map((f, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex gap-2">
              <Input value={f.question} onChange={(e) => { setStatus(null); setFaq((l) => l.map((x, j) => (j === i ? { ...x, question: e.target.value } : x))); }} placeholder="Y a-t-il un parking ?" aria-label={`Question ${i + 1}`} maxLength={200} />
              <button type="button" onClick={() => setFaq((l) => l.filter((_, j) => j !== i))} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer la question ${i + 1}`}><Trash2 className="size-4" aria-hidden="true" /></button>
            </div>
            <Textarea value={f.answer} onChange={(e) => { setStatus(null); setFaq((l) => l.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x))); }} placeholder="Réponse" aria-label={`Réponse ${i + 1}`} rows={2} maxLength={1500} />
          </div>
        ))}
        <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden="true" />} disabled={faq.length >= 20} onClick={() => setFaq((l) => [...l, { question: "", answer: "" }])}>Ajouter une question fréquente</Button>
      </div>
      <SaveBar
        dirty={dirty}
        pending={pending}
        status={status}
        onReset={() => { setFaq(saved); setStatus(null); }}
        onSave={() =>
          start(async () => {
            const clean = faq.filter((f) => f.question.trim() || f.answer.trim());
            const res = await saveFaq(clean);
            if (res.ok) { setFaq(clean); setSaved(clean); setStatus({ ok: true, msg: "Questions fréquentes enregistrées." }); }
            else setStatus({ ok: false, msg: res.error });
          })
        }
      />
    </Card>
  );
}
