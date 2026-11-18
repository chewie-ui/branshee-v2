"use client";

import { useState, useTransition } from "react";
import { IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatNiss, validNiss } from "@/lib/niss";
import { savePatientIdentity, setArchived } from "@/server/actions/physio";

export type PatientIdentity = { niss: string; birthDate: string; sex: string; mutuality: string; mutualityNumber: string; prescriberName: string; prescriberInami: string; gpName: string; gpInami: string; archived: boolean };

const MUTUALITIES = ["Mutualité chrétienne (MC)", "Solidaris", "Partenamut", "Mutualité libérale", "Mutualités Libres (Helan, Partena…)", "Mutualité neutre", "CAAMI / HZIV", "HR Rail", "Autre"];

/** Fiche patient (soins) : identité administrative du dossier, NISS unique dans l'établissement. */
export function PatientIdentityForm({ customerId, initial, canManage }: { customerId: string; initial: PatientIdentity; canManage: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [niss, setNiss] = useState(initial.niss ? formatNiss(initial.niss) : "");
  const [pending, start] = useTransition();
  const nissBad = niss.replace(/\D/g, "").length === 11 && !validNiss(niss);
  return (
    <Card>
      <CardHeader title="Identité du patient" description="Données administratives du dossier de soins. Le NISS est chiffré et ne peut exister que sur une seule fiche." action={initial.archived ? <span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Dossier archivé</span> : null} />
      <form
        className="space-y-4 p-5 pt-0"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = Object.fromEntries(new FormData(e.currentTarget));
          setMsg(null);
          start(async () => {
            const r = await savePatientIdentity(customerId, fd);
            setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          });
        }}
      >
        <fieldset disabled={!canManage} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="NISS (numéro de registre national)" htmlFor="pi-niss" error={nissBad ? "Clé de contrôle incorrecte." : undefined} hint="Au verso de la carte d'identité. Remplit la date de naissance et le sexe.">
            <Input id="pi-niss" name="niss" value={niss} onChange={(e) => setNiss(e.target.value)} inputMode="numeric" placeholder="85.07.30-033.28" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Date de naissance" htmlFor="pi-birth">
              <Input id="pi-birth" name="birthDate" type="date" defaultValue={initial.birthDate} />
            </Field>
            <Field label="Sexe" htmlFor="pi-sex">
              <Select id="pi-sex" name="sex" defaultValue={initial.sex}>
                <option value="">—</option>
                <option value="F">F</option>
                <option value="M">M</option>
                <option value="X">X</option>
              </Select>
            </Field>
          </div>
          <Field label="Mutuelle" htmlFor="pi-mut">
            <Input id="pi-mut" name="mutuality" list="pi-mut-list" defaultValue={initial.mutuality} maxLength={80} />
          </Field>
          <datalist id="pi-mut-list">{MUTUALITIES.map((m) => <option key={m} value={m} />)}</datalist>
          <Field label="N° d'affiliation (facultatif)" htmlFor="pi-mutn">
            <Input id="pi-mutn" name="mutualityNumber" defaultValue={initial.mutualityNumber} maxLength={40} />
          </Field>
          <Field label="Médecin prescripteur" htmlFor="pi-presc">
            <Input id="pi-presc" name="prescriberName" defaultValue={initial.prescriberName} maxLength={120} placeholder="Dr Dupont" />
          </Field>
          <Field label="N° INAMI du prescripteur" htmlFor="pi-presci">
            <Input id="pi-presci" name="prescriberInami" defaultValue={initial.prescriberInami} maxLength={20} inputMode="numeric" placeholder="1-23456-78-901" />
          </Field>
          <Field label="Médecin généraliste" htmlFor="pi-gp">
            <Input id="pi-gp" name="gpName" defaultValue={initial.gpName} maxLength={120} />
          </Field>
          <Field label="N° INAMI du généraliste" htmlFor="pi-gpi">
            <Input id="pi-gpi" name="gpInami" defaultValue={initial.gpInami} maxLength={20} inputMode="numeric" />
          </Field>
        </fieldset>
        {msg ? <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={pending} icon={<IdCard className="size-4" aria-hidden="true" />} disabled={nissBad}>Enregistrer l&apos;identité</Button>
            <Button type="button" variant="ghost" onClick={() => start(async () => { const r = await setArchived(customerId, !initial.archived); setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error }); })}>
              {initial.archived ? "Réactiver le dossier" : "Archiver le dossier"}
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
