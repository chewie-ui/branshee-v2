"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { CARE_TEAM_ROLES, careRoleLabel } from "@/lib/care-team";
import { removeCareTeamMember, saveCareTeamMember } from "@/server/actions/care-team";

export type TeamMember = { id: string; role: string; name: string; profession: string; inami: string; enterpriseNumber: string; address: string; phone: string; email: string; iban: string };
const EMPTY: Omit<TeamMember, "id"> = { role: "gp", name: "", profession: "", inami: "", enterpriseNumber: "", address: "", phone: "", email: "", iban: "" };

function MemberForm({ customerId, m, onDone }: { customerId: string; m: TeamMember | null; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const v = m ?? { id: "", ...EMPTY };
  const p = `ct-${m?.id ?? "new"}`;
  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-surface-muted/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget));
        setError(null);
        start(async () => {
          const r = await saveCareTeamMember(customerId, m?.id ?? null, fd);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Rôle" htmlFor={`${p}-role`}>
          <Select id={`${p}-role`} name="role" defaultValue={v.role}>{CARE_TEAM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</Select>
        </Field>
        <Field label="Nom" htmlFor={`${p}-name`}><Input id={`${p}-name`} name="name" defaultValue={v.name} required maxLength={120} placeholder="Dr Dupont" /></Field>
        <Field label="Profession / spécialité" htmlFor={`${p}-prof`}><Input id={`${p}-prof`} name="profession" defaultValue={v.profession} maxLength={80} placeholder="Orthopédiste…" /></Field>
        <Field label="N° INAMI" htmlFor={`${p}-inami`}><Input id={`${p}-inami`} name="inami" defaultValue={v.inami} maxLength={20} inputMode="numeric" /></Field>
        <Field label="Téléphone" htmlFor={`${p}-phone`}><Input id={`${p}-phone`} name="phone" defaultValue={v.phone} maxLength={40} type="tel" /></Field>
        <Field label="Email" htmlFor={`${p}-email`}><Input id={`${p}-email`} name="email" defaultValue={v.email} maxLength={160} type="email" /></Field>
        <Field label="Adresse" htmlFor={`${p}-addr`} className="sm:col-span-2"><Input id={`${p}-addr`} name="address" defaultValue={v.address} maxLength={200} /></Field>
        <Field label="N° d'entreprise (facultatif)" htmlFor={`${p}-bce`}><Input id={`${p}-bce`} name="enterpriseNumber" defaultValue={v.enterpriseNumber} maxLength={20} /></Field>
        <Field label="Compte bancaire (facultatif)" htmlFor={`${p}-iban`}><Input id={`${p}-iban`} name="iban" defaultValue={v.iban} maxLength={40} /></Field>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>Enregistrer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
    </form>
  );
}

/** Équipe de soins du patient : généraliste, prescripteur, spécialistes, infirmier, aide familiale… */
export function CareTeam({ customerId, members, canManage }: { customerId: string; members: TeamMember[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  return (
    <Card>
      <CardHeader title="Équipe de soins" description="Les autres soignants du patient : leurs coordonnées servent aux rapports et courriers." action={canManage && editing !== "new" ? <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Ajouter</Button> : null} />
      <div className="space-y-3 px-5 pb-5">
        {editing === "new" ? <MemberForm customerId={customerId} m={null} onDone={done} /> : null}
        {members.length === 0 && editing !== "new" ? <p className="flex items-center gap-2 text-sm text-muted"><Users className="size-4" aria-hidden="true" />Aucun soignant ajouté.</p> : null}
        <ul className="divide-y divide-border">
          {members.map((m) =>
            editing === m.id ? (
              <li key={m.id} className="py-3"><MemberForm customerId={customerId} m={m} onDone={done} /></li>
            ) : (
              <li key={m.id} className="flex items-start gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name}<span className="font-normal text-muted"> · {careRoleLabel(m.role)}{m.profession ? ` (${m.profession})` : ""}</span></p>
                  <p className="text-muted">{[m.inami && `INAMI ${m.inami}`, m.phone, m.email, m.address].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {canManage ? (
                  <span className="flex gap-1">
                    <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label={`Modifier ${m.name}`} onClick={() => setEditing(m.id)}><Pencil className="size-4" aria-hidden="true" /></button>
                    <button type="button" disabled={pending} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-danger-soft hover:text-danger" aria-label={`Retirer ${m.name}`} onClick={() => start(async () => { await removeCareTeamMember(customerId, m.id); router.refresh(); })}><Trash2 className="size-4" aria-hidden="true" /></button>
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ul>
      </div>
    </Card>
  );
}
