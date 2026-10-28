"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Crown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PERMISSIONS, type Permissions } from "@/lib/permissions";
import { deleteGrade, saveGrade, type TeamState } from "@/server/actions/team";
import { submitKeepingValues } from "@/lib/form";

export function GradeForm({ id, name, permissions, isBuiltIn, apps, appAccess = null }: { id: string | null; name: string; permissions: Permissions; isBuiltIn: boolean; apps?: { id: string; name: string }[]; appAccess?: string[] | null }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(saveGrade.bind(null, id), undefined);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const perms = permissions as Record<string, Record<string, boolean>>;
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"all" | "some">(appAccess ? "some" : "all");
  /** « Tout gérer comme le patron » : toutes les permissions et toutes les apps. */
  const everything = () => {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type=checkbox][data-perm]').forEach((i) => (i.checked = true));
    setMode("all");
  };

  return (
    <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      {state?.error ? <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{state.error}</p> : null}
      <Card className="p-5">
        <Field label="Nom du grade" htmlFor="name" error={state?.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={name} maxLength={40} className="sm:max-w-sm" />
        </Field>
      </Card>

      {apps ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
            <div className="flex-1">
              <h2 className="text-base font-semibold">Apps accessibles</h2>
              <p className="mt-0.5 text-sm text-muted">Les apps que ce grade voit. Ex. : un comptable n&apos;a que Factures, Dépenses et Comptabilité.</p>
            </div>
            <Button type="button" size="sm" variant="secondary" icon={<Crown className="size-4" aria-hidden="true" />} onClick={everything}>Tout gérer comme le patron</Button>
          </div>
          <fieldset className="space-y-3 px-5 py-4">
            <legend className="sr-only">Apps accessibles</legend>
            <input type="hidden" name="appMode" value={mode} />
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="appModeChoice" checked={mode === "all"} onChange={() => setMode("all")} className="size-4" />Toutes les apps</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="appModeChoice" checked={mode === "some"} onChange={() => setMode("some")} className="size-4" />Seulement certaines apps</label>
            {mode === "some" ? (
              <div className="grid gap-2 pl-6 sm:grid-cols-3">
                {apps.map((a) => <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`app.${a.id}`} defaultChecked={appAccess?.includes(a.id) ?? false} className="size-4 accent-[var(--accent)]" />{a.name}</label>)}
              </div>
            ) : null}
          </fieldset>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Permissions</h2>
          <p className="mt-0.5 text-sm text-muted">Ce que les membres de ce grade peuvent faire. Les sections non autorisées disparaissent de leur menu.</p>
        </div>
        <div className="divide-y divide-border">
          {Object.entries(PERMISSIONS).map(([domain, def]) => (
            <fieldset key={domain} className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[200px_1fr]">
              <legend className="contents">
                <span className="text-sm font-semibold">{def.label}</span>
              </legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {Object.entries(def.actions).map(([action, label]) => (
                  <label key={action} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" data-perm name={`${domain}.${action}`} defaultChecked={perms[domain]?.[action] === true} className="size-4 accent-[var(--accent)]" />
                    {label as string}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {id && !isBuiltIn ? (
          confirm ? (
            <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
              <span className="text-sm text-danger">Supprimer ce grade ?</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={deleting}>Non</Button>
              <Button type="button" variant="danger" size="sm" loading={deleting} onClick={() => startDelete(async () => { const r = await deleteGrade(id); if (!r.ok) setDeleteError(r.error ?? "Erreur."); })}>Oui, supprimer</Button>
              {deleteError ? <span className="w-full text-sm text-danger" role="alert">{deleteError}</span> : null}
            </div>
          ) : (
            <Button type="button" variant="ghost" className="text-danger hover:text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Supprimer le grade</Button>
          )
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/app/equipe/grades" className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text sm:flex-none">Annuler</Link>
          <Button type="submit" loading={pending} className="flex-1 sm:flex-none">{id ? "Enregistrer" : "Créer le grade"}</Button>
        </div>
      </div>
    </form>
  );
}
