"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { parseQuickTime } from "@/lib/time-input";
import { cancelAppointment, saveBlock } from "@/server/actions/appointments";

type Initial = { id: string | null; date: string; start: string; end: string; memberId: string; note: string };

export function BlockForm({ initial, members }: { initial: Initial; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Initial>) => setV((x) => ({ ...x, ...patch }));
  const back = () => router.push(`/app/agenda?semaine=${v.date}`);

  return (
    <Card className="space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="b-date">
          <Input id="b-date" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="De" htmlFor="b-start" hint="Ex. 12 ou 12h30">
          <Input id="b-start" value={v.start} onChange={(e) => set({ start: e.target.value })} onBlur={() => set({ start: parseQuickTime(v.start) ?? v.start })} inputMode="numeric" />
        </Field>
        <Field label="À" htmlFor="b-end">
          <Input id="b-end" value={v.end} onChange={(e) => set({ end: e.target.value })} onBlur={() => set({ end: parseQuickTime(v.end) ?? v.end })} inputMode="numeric" />
        </Field>
      </div>
      {members.length > 1 ? (
        <Field label="Pour qui ?" htmlFor="b-member">
          <Select id="b-member" value={v.memberId} onChange={(e) => set({ memberId: e.target.value })}>
            <option value="">Tout l&apos;établissement</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Commentaire (facultatif)" htmlFor="b-note" hint="Visible uniquement par votre équipe.">
        <Input id="b-note" value={v.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ex. dentiste, pause, formation…" maxLength={200} />
      </Field>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {confirmDelete ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
          <p className="mr-auto text-sm text-danger">Supprimer ce blocage ? Le créneau redevient réservable.</p>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={pending}>Non</Button>
          <Button variant="danger" size="sm" loading={pending} onClick={() => start(async () => { await cancelAppointment(v.id!); back(); })}>Oui, supprimer</Button>
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {v.id ? (
          <Button variant="ghost" className="text-danger hover:text-danger sm:mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
            Supprimer le blocage
          </Button>
        ) : null}
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="ghost" onClick={back} disabled={pending} className="flex-1 sm:flex-none">Annuler</Button>
          <Button
            loading={pending}
            className="flex-1 sm:flex-none"
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await saveBlock(v.id, { date: v.date, start: v.start, end: v.end, memberId: v.memberId, note: v.note });
                if (r.ok) back();
                else setError(r.error);
              })
            }
          >
            {v.id ? "Enregistrer" : "Bloquer ce créneau"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
