"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { COLOR_LABELS, PROJECT_COLORS, type ProjectColor } from "@/lib/projects";
import { saveProject } from "@/server/actions/projects";
import type { ProjectCard } from "@/server/projects";

export type CustomerOption = { id: string; name: string };

/** Fenêtre « Nouveau projet » / « Modifier le projet ». */
export function ProjectDialog({ project, customers, onClose, onDone }: { project: ProjectCard | null; customers: CustomerOption[]; onClose: () => void; onDone: (text: string) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    customerId: project?.customerId ?? "",
    color: project?.color ?? "indigo",
    rate: project?.hourlyRateCents ? String(project.hourlyRateCents / 100).replace(".", ",") : "",
    budgetHours: project?.budgetMinutes ? String(Math.round((project.budgetMinutes / 60) * 100) / 100).replace(".", ",") : "",
    deadline: project?.deadline ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await saveProject({ ...f, id: project?.id }).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error);
      onDone(r.message ?? "Enregistré.");
      if (!project && r.url) router.push(r.url);
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pj-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <form ref={ref} onSubmit={submit} className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-xl sm:rounded-2xl" noValidate>
        <h2 id="pj-title" className="text-lg font-semibold">{project ? "Modifier le projet" : "Nouveau projet"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nom du projet" htmlFor="pj-name" className="sm:col-span-2"><Input id="pj-name" value={f.name} onChange={set("name")} maxLength={120} placeholder="Ex. : Rénovation cuisine Dupont" required /></Field>
          <Field label="Client" htmlFor="pj-customer" className="sm:col-span-2">
            <Select id="pj-customer" value={f.customerId} onChange={set("customerId")}>
              <option value="">Pas de client (projet interne)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Tarif horaire (€ HTVA)" htmlFor="pj-rate" hint="Pour facturer le temps passé"><Input id="pj-rate" inputMode="decimal" value={f.rate} onChange={set("rate")} placeholder="0" /></Field>
          <Field label="Budget (heures)" htmlFor="pj-budget" hint="Facultatif"><Input id="pj-budget" inputMode="decimal" value={f.budgetHours} onChange={set("budgetHours")} /></Field>
          <Field label="Échéance" htmlFor="pj-deadline"><Input id="pj-deadline" type="date" value={f.deadline} onChange={set("deadline")} /></Field>
          <div>
            <p className="text-sm font-medium" id="pj-color">Couleur</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="pj-color">
              {Object.entries(PROJECT_COLORS).map(([c, cls]) => (
                <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={COLOR_LABELS[c as ProjectColor]} onClick={() => setF((s) => ({ ...s, color: c }))} className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", cls, f.color === c ? "ring-2 ring-text" : "hover:ring-2 hover:ring-border-strong")} />
              ))}
            </div>
          </div>
          <Field label="Description (facultatif)" htmlFor="pj-desc" className="sm:col-span-2"><Textarea id="pj-desc" rows={3} value={f.description} onChange={set("description")} maxLength={1000} /></Field>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" loading={pending}>{project ? "Enregistrer" : "Créer le projet"}</Button>
        </div>
      </form>
    </div>
  );
}
