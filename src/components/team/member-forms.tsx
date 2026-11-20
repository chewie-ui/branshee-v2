"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, UserMinus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { addMember, removeMember, setMemberPhoto, updateMember, type TeamState } from "@/server/actions/team";
import { submitKeepingValues } from "@/lib/form";
import { useT } from "@/components/app-locale";

type Grade = { id: string; name: string };

function Errors({ state }: { state: TeamState }) {
  const t = useT();
  if (state?.error) return <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="rounded-lg bg-success-soft px-4 py-3 text-sm text-success" role="status">{t("Modifications enregistrées.")}</p>;
  return null;
}

export function AddMemberForm({ grades, defaultGradeId }: { grades: Grade[]; defaultGradeId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<TeamState, FormData>(addMember, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      <Errors state={state} />
      <Card className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Nom affiché")} htmlFor="displayName" error={err.displayName}>
            <Input id="displayName" name="displayName" maxLength={80} aria-invalid={!!err.displayName || undefined} />
          </Field>
          <Field label={t("Fonction (facultatif)")} htmlFor="roleLabel" hint={t("Ex. : Ostéopathe, Coiffeuse senior…")}>
            <Input id="roleLabel" name="roleLabel" maxLength={60} />
          </Field>
        </div>
        <Field label={t("Email (facultatif)")} htmlFor="email" error={err.email} hint={t("Pour qu'il puisse se connecter : il reçoit une invitation, crée son compte avec cette adresse, confirme son e-mail puis accepte l'invitation.")}>
          <Input id="email" name="email" type="email" aria-invalid={!!err.email || undefined} />
        </Field>
        <Field label="Grade" htmlFor="gradeId" hint={t("Définit ce qu'il peut voir et faire dans l'espace pro.")}>
          <Select id="gradeId" name="gradeId" defaultValue={defaultGradeId}>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="isBookable" defaultChecked className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">{t("Réservable par les clients")}</span>
            <span className="block text-muted">{t("Décochez pour un membre qui ne reçoit pas de clients (secrétariat…).")}</span>
          </span>
        </label>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href="/app/equipe" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text">{t("Annuler")}</Link>
        <Button type="submit" loading={pending}>{t("Ajouter à l'équipe")}</Button>
      </div>
    </form>
  );
}

type Member = { id: string; displayName: string; photo: string | null; ownPhoto: boolean; roleLabel: string; bio: string; customInfo: string; showRole: boolean; gradeId: string; isBookable: boolean; isActive: boolean; isOwner: boolean; timeOff: "inherit" | "yes" | "no"; isSelf: boolean };

/** Photo de profil : changée tout de suite ; sans photo choisie, celle du compte du membre s'affiche. */
function MemberPhoto({ memberId, name, initial, own }: { memberId: string; name: string; initial: string | null; own: boolean }) {
  const t = useT();
  const [photo, setPhoto] = useState(initial);
  const [mine, setMine] = useState(own);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const send = (fd: FormData) =>
    start(async () => {
      const r = await setMemberPhoto(memberId, fd);
      if (r.ok) {
        setPhoto(r.url ?? null);
        setMine(fd.get("remove") !== "1");
      }
      setMsg({ ok: r.ok, text: r.ok ? (fd.get("remove") === "1" ? t("Photo retirée.") : t("Photo enregistrée.")) : t(r.error ?? "Erreur.") });
    });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={photo} size="lg" className="size-16 text-base" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted ${pending ? "pointer-events-none opacity-60" : ""}`}>
            <Camera className="size-4" aria-hidden="true" />
            {photo ? t("Changer la photo") : t("Ajouter une photo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("photo", f);
                send(fd);
                e.target.value = "";
              }}
            />
          </label>
          {mine ? (
            <Button type="button" variant="ghost" loading={pending} onClick={() => { const fd = new FormData(); fd.set("remove", "1"); send(fd); }}>{t("Retirer")}</Button>
          ) : null}
        </div>
        <p className="text-sm text-muted">{mine ? t("Affichée dans l'équipe et sur la page de réservation.") : photo ? t("Photo de son compte, utilisée par défaut.") : t("JPG, PNG ou WebP, 5 Mo maximum.")}</p>
        {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </div>
    </div>
  );
}

export function EditMemberForm({ m, grades }: { m: Member; grades: Grade[] }) {
  const t = useT();
  const [state, action, pending] = useActionState<TeamState, FormData>(updateMember.bind(null, m.id), undefined);
  const [confirm, setConfirm] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const err = state?.fieldErrors ?? {};

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-6" noValidate>
      <Errors state={state} />
      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">{t("Profil public")}</h2>
        <MemberPhoto memberId={m.id} name={m.displayName} initial={m.photo} own={m.ownPhoto} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Nom affiché")} htmlFor="displayName" error={err.displayName}>
            <Input id="displayName" name="displayName" defaultValue={m.displayName} maxLength={80} />
          </Field>
          <Field label="Fonction" htmlFor="roleLabel">
            <Input id="roleLabel" name="roleLabel" defaultValue={m.roleLabel} maxLength={60} />
          </Field>
        </div>
        <Field label={t("Présentation (facultatif)")} htmlFor="bio">
          <Textarea id="bio" name="bio" defaultValue={m.bio} rows={3} maxLength={500} />
        </Field>
        <Field label={t("Infos complémentaires (facultatif)")} htmlFor="customInfo" hint={t("Une ligne par info, au format « Libellé : valeur ». Ex. : Langues : français, anglais — N° INAMI : 5-12345-67-890")}>
          <Textarea id="customInfo" name="customInfo" defaultValue={m.customInfo} rows={3} maxLength={1200} placeholder={"Langues : français, anglais\nSpécialité : rééducation du sportif"} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="showRole" defaultChecked={m.showRole} className="size-4 accent-[var(--accent)]" />
          {t("Afficher la fonction sur la page de réservation")}
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="isBookable" defaultChecked={m.isBookable} className="size-4 accent-[var(--accent)]" />
          {t("Réservable par les clients")}
        </label>
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="text-base font-semibold">Accès</h2>
        {m.isOwner ? (
          <p className="text-sm text-muted">{t("Propriétaire de l'établissement : accès complet à tout.")}</p>
        ) : (
          <>
            <Field label="Grade" htmlFor="gradeId" hint={m.isSelf ? t("Vous ne pouvez pas changer votre propre grade.") : undefined}>
              <Select id="gradeId" name="gradeId" defaultValue={m.gradeId} disabled={m.isSelf}>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              {m.isSelf ? <input type="hidden" name="gradeId" value={m.gradeId} /> : null}
            </Field>
            <Field label={t("Gestion de ses propres congés")} htmlFor="timeOff">
              <Select id="timeOff" name="timeOff" defaultValue={m.timeOff}>
                <option value="inherit">{t("Selon son grade")}</option>
                <option value="yes">Autorisée</option>
                <option value="no">{t("Non autorisée")}</option>
              </Select>
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={m.isActive} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">{t("Compte actif")}</span>
                <span className="block text-muted">{t("Décochez pour bloquer temporairement son accès sans le retirer de l'équipe.")}</span>
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
              <Button type="button" variant="danger" size="sm" loading={removing} onClick={() => startRemove(async () => { const r = await removeMember(m.id); if (!r.ok) setRemoveError(r.error ?? t("Erreur.")); })}>{t("Oui, retirer")}</Button>
              {removeError ? <span className="text-sm text-danger" role="alert">{removeError}</span> : null}
            </div>
          ) : (
            <Button type="button" variant="ghost" className="text-danger hover:text-danger sm:mr-auto" icon={<UserMinus className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>
              {t("Retirer de l'équipe")}
            </Button>
          )
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          <Link href="/app/equipe" className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text sm:flex-none">{t("Retour")}</Link>
          <Button type="submit" loading={pending} className="flex-1 sm:flex-none">{t("Enregistrer")}</Button>
        </div>
      </div>
    </form>
  );
}
