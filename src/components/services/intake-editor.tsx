"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { IntakeQuestion } from "@/lib/intake";
import { deleteIntakeQuestion, moveIntakeQuestion, saveIntakeQuestion } from "@/server/actions/intake";

type Service = { id: string; name: string; isActive: boolean };
type Draft = { question: string; options: { id: string | null; label: string; serviceIds: string[] }[] };

const blank = (): Draft => ({ question: "", options: [{ id: null, label: "Oui", serviceIds: [] }, { id: null, label: "Non", serviceIds: [] }] });

/** Fiche d'une question : lecture, ou formulaire d'édition. */
export function IntakeQuestionCard({ question, services, index, total }: { question: IntakeQuestion; services: Service[]; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const name = (id: string) => services.find((s) => s.id === id)?.name;

  if (editing) return <IntakeForm id={question.id} initial={{ question: question.question, options: question.options }} services={services} onDone={() => setEditing(false)} />;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-foreground">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{question.question}</h3>
          <ul className="mt-3 space-y-2">
            {question.options.map((o) => (
              <li key={o.id} className="text-sm">
                <span className="font-medium">{o.label}</span>
                <span className="text-muted"> → {o.serviceIds.length ? o.serviceIds.map(name).filter(Boolean).join(", ") : "aucune prestation en particulier"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={index === 0 || pending} onClick={() => start(async () => void (await moveIntakeQuestion(question.id, "up")))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30" aria-label="Poser plus tôt">
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
          <button type="button" disabled={index === total - 1 || pending} onClick={() => start(async () => void (await moveIntakeQuestion(question.id, "down")))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30" aria-label="Poser plus tard">
            <ArrowDown className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setEditing(true)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Modifier la question">
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer la question">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {confirmDelete ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
          <p className="mr-auto text-sm text-danger">Supprimer cette question ? Les prestations liées seront à nouveau proposées à tout le monde.</p>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={pending}>Non</Button>
          <Button variant="danger" size="sm" loading={pending} onClick={() => start(async () => void (await deleteIntakeQuestion(question.id)))}>Oui, supprimer</Button>
        </div>
      ) : null}
    </Card>
  );
}

export function NewIntakeQuestion({ services, first }: { services: Service[]; first: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant={first ? "primary" : "secondary"} data-tour="new-intake" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
        {first ? "Ajouter une question" : "Ajouter une autre question"}
      </Button>
    );
  return <IntakeForm id={null} initial={blank()} services={services} onDone={() => setOpen(false)} />;
}

function IntakeForm({ id, initial, services, onDone }: { id: string | null; initial: Draft; services: Service[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const setOption = (i: number, patch: Partial<Draft["options"][number]>) => setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const toggle = (i: number, serviceId: string) => {
    const o = draft.options[i]!;
    setOption(i, { serviceIds: o.serviceIds.includes(serviceId) ? o.serviceIds.filter((x) => x !== serviceId) : [...o.serviceIds, serviceId] });
  };

  return (
    <Card className="space-y-5 p-5">
      <Field label="Question posée au client" htmlFor={`q-${id ?? "new"}`}>
        <Input id={`q-${id ?? "new"}`} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} placeholder="Êtes-vous enceinte ?" maxLength={160} autoFocus />
      </Field>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Réponses possibles, et les prestations que chacune affiche</legend>
        {draft.options.map((o, i) => (
          <div key={o.id ?? `new-${i}`} className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <Input value={o.label} onChange={(e) => setOption(i, { label: e.target.value })} maxLength={80} aria-label={`Texte de la réponse ${i + 1}`} className="font-medium" />
              <button type="button" disabled={draft.options.length <= 2} onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, j) => j !== i) }))} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-30" aria-label={`Supprimer la réponse ${i + 1}`}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 mb-2 text-sm text-muted">Si le client répond « {o.label || "…"} », proposer :</p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => {
                const on = o.serviceIds.includes(s.id);
                return (
                  <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(i, s.id)} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-accent bg-accent-soft font-medium text-accent-soft-foreground" : "border-border-strong bg-surface text-muted hover:text-text", !s.isActive && "italic")}>
                    {s.name}
                    {!s.isActive ? " (masquée)" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button type="button" disabled={draft.options.length >= 12} onClick={() => setDraft((d) => ({ ...d, options: [...d.options, { id: null, label: "", serviceIds: [] }] }))} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-40">
          <Plus className="size-4" aria-hidden="true" />
          Ajouter une réponse
        </button>
      </fieldset>

      <p className="rounded-lg bg-surface-muted p-3 text-sm text-muted">Une prestation cochée sous aucune réponse reste proposée à tout le monde, quelle que soit la réponse.</p>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>Annuler</Button>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveIntakeQuestion(id, draft);
              if (r.ok) onDone();
              else setError(r.error);
            })
          }
        >
          Enregistrer
        </Button>
      </div>
    </Card>
  );
}
