"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { addMember, removeMember, updateMember, type TeamState } from "@/server/actions/team";
import { submitKeepingValues } from "@/lib/form";

type Grade = { id: string; name: string };

function Errors({ state }: { state: TeamState }) {
  if (state?.error) return <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success" role="status">Modifications enregistrées.</p>;
  return null;
}

export function AddMemberForm({ grades, defaultGradeId }: { grades: Grade[]; defaultGradeId: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(addMember, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      <Errors state={state} />
      <Card className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom affiché" htmlFor="displayName" error={err.displayName}>
            <Input id="displayName" name="displayName" maxLength={80} aria-invalid={!!err.displayName || undefined} />
          </Field>
          <Field label="Fonction (facultatif)" htmlFor="roleLabel" hint="Ex. : Ostéopathe, Coiffeuse senior…">
            <Input id="roleLabel" name="roleLabel" maxLength={60} />
          </Field>
        </div>
        <Field label="Email (facultatif)" htmlFor="email" error={err.email} hint="Pour qu'il puisse se connecter : il crée son compte avec cette adresse et rejoint automatiquement l'équipe.">
          <Input id="email" name="email" type="email" aria-invalid={!!err.email || undefined} />
        </Field>
        <Field label="Grade" htmlFor="gradeId" hint="Définit ce qu'il peut voir et faire dans l'espace pro.">
          <Select id="gradeId" name="gradeId" defaultValue={defaultGradeId}>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="isBookable" defaultChecked className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Réservable par les clients</span>
            <span className="block text-muted">Décochez pour un membre qui ne reçoit pas de clients (secrétariat…).</span>
          </span>
        </label>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href="/app/equipe" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text">Annuler</Link>
        <Button type="submit" loading={pending}>Ajouter à l&apos;équipe</Button>
      </div>
    </form>
  );
}

type Member = { id: string; displayName: string; roleLabel: string; bio: string; showRole: boolean; gradeId: string; isBookable: boolean; isActive: boolean; isOwner: boolean; timeOff: "inherit" | "yes" | "no"; isSelf: boolean };

export function EditMemberForm({ m, grades }: { m: Member; grades: Grade[] }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(updateMember.bind(null, m.id), undefined);
  const [confirm, setConfirm] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const err = state?.fieldErrors ?? {};

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      <Errors state={state} />
      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">Profil public</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom affiché" htmlFor="displayName" error={err.displayName}>
            <Input id="displayName" name="displayName" defaultValue={m.displayName} maxLength={80} />
          </Field>
          <Field label="Fonction" htmlFor="roleLabel">
            <Input id="roleLabel" name="roleLabel" defaultValue={m.roleLabel} maxLength={60} />
          </Field>
        </div>
        <Field label="Présentation (facultatif)" htmlFor="bio">
          <Textarea id="bio" name="bio" defaultValue={m.bio} rows={3} maxLength={500} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="showRole" defaultChecked={m.showRole} className="size-4 accent-[var(--accent)]" />
          Afficher la fonction sur la page de réservation
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="isBookable" defaultChecked={m.isBookable} className="size-4 accent-[var(--accent)]" />
          Réservable par les clients
        </label>
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">Accès</h2>
        {m.isOwner ? (
          <p className="text-sm text-muted">Propriétaire de l&apos;établissement : accès complet à tout.</p>
        ) : (
          <>
            <Field label="Grade" htmlFor="gradeId" hint={m.isSelf ? "Vous ne pouvez pas changer votre propre grade." : undefined}>
              <Select id="gradeId" name="gradeId" defaultValue={m.gradeId} disabled={m.isSelf}>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              {m.isSelf ? <input type="hidden" name="gradeId" value={m.gradeId} /> : null}
            </Field>
            <Field label="Gestion de ses propres congés" htmlFor="timeOff">
              <Select id="timeOff" name="timeOff" defaultValue={m.timeOff}>
                <option value="inherit">Selon son grade</option>
                <option value="yes">Autorisée</option>
                <option value="no">Non autorisée</option>
              </Select>
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={m.isActive} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">Compte actif</span>
                <span className="block text-muted">Décochez pour bloquer temporairement son accès sans le retirer de l&apos;équipe.</span>
              </span>
            </label>
          </>
        )}
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {!m.isOwner && !m.isSelf ? (
          confirm ? (
            <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
              <span className="text-sm text-danger">Retirer {m.displayName} de l&apos;équipe ?</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={removing}>Non</Button>
              <Button type="button" variant="danger" size="sm" loading={removing} onClick={() => startRemove(async () => { const r = await removeMember(m.id); if (!r.ok) setRemoveError(r.error ?? "Erreur."); })}>Oui, retirer</Button>
              {removeError ? <span className="text-sm text-danger" role="alert">{removeError}</span> : null}
            </div>
          ) : (
            <Button type="button" variant="ghost" className="text-danger hover:text-danger sm:mr-auto" icon={<UserMinus className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>
              Retirer de l&apos;équipe
            </Button>
          )
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/app/equipe" className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text sm:flex-none">Retour</Link>
          <Button type="submit" loading={pending} className="flex-1 sm:flex-none">Enregistrer</Button>
        </div>
      </div>
    </form>
  );
}
