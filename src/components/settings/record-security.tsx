"use client";

import { useState, useTransition } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { saveAutoLock } from "@/server/actions/physio";

/** Sécurité des dossiers patients : verrouillage après inactivité et export du journal des accès. */
export function RecordSecurity({ minutes, canManage }: { minutes: number | null; canManage: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Sécurité des dossiers patients" description="Chaque ouverture, modification, impression et export d'un dossier est enregistré avec la personne et l'heure." />
      <div className="flex flex-col gap-4 p-5 pt-0 sm:flex-row sm:items-end">
        <label className="block text-sm font-medium" htmlFor="autolock">
          Verrouiller la session après
          <Select
            id="autolock"
            className="mt-1.5 sm:w-56"
            disabled={!canManage || pending}
            defaultValue={minutes ? String(minutes) : "none"}
            onChange={(e) => {
              const v = e.target.value === "none" ? null : Number(e.target.value);
              start(async () => { const r = await saveAutoLock(v); setMsg(r.ok ? r.message : r.error); });
            }}
          >
            <option value="none">Jamais</option>
            {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes sans activité{m === 15 ? " (recommandé)" : ""}</option>)}
          </Select>
        </label>
        <a href="/app/reglages/journal/acces" download className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted"><Download className="size-4" aria-hidden="true" />Journal des accès (CSV)</a>
      </div>
      {msg ? <p className="flex items-center gap-1.5 px-5 pb-5 text-sm text-success" role="status"><ShieldCheck className="size-4" aria-hidden="true" />{msg}</p> : null}
    </Card>
  );
}
