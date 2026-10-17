"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAppointments } from "@/server/actions/appointments";

type Row = { id: string; name: string; customerId: string | null; service: string; member: string; when: string; state: "confirme" | "termine" | "annule" | "absent" | "attente" };
const BADGE: Record<Row["state"], { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  confirme: { label: "Confirmé", tone: "accent" },
  termine: { label: "Terminé", tone: "neutral" },
  annule: { label: "Annulé", tone: "danger" },
  absent: { label: "Absent", tone: "warning" },
  attente: { label: "En attente", tone: "warning" },
};

export function HistoryTable({ rows, canDelete }: { rows: Row[]; canDelete: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (rows.length === 0) return <p className="p-6 text-center text-sm text-muted">Aucun rendez-vous ne correspond à ces filtres.</p>;

  return (
    <>
      {canDelete && selected.length ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent-soft px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</span>
          <button type="button" onClick={() => setSelected([])} className="text-muted hover:text-text">Tout désélectionner</button>
          {confirm ? (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-danger">Supprimer définitivement ?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>Non</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => { await deleteAppointments(selected); setSelected([]); setConfirm(false); })}>Oui, supprimer</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="ml-auto text-danger hover:text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Supprimer</Button>
          )}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs text-muted uppercase">
            <tr>
              {canDelete ? (
                <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={all} onChange={() => setSelected(all ? [] : rows.map((r) => r.id))} className="size-4 accent-[var(--accent)]" aria-label="Tout sélectionner" /></th>
              ) : null}
              <th className="px-4 py-2.5 font-medium">Nom</th>
              <th className="px-4 py-2.5 font-medium">Prestation</th>
              <th className="px-4 py-2.5 font-medium">Avec</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-muted/60">
                {canDelete ? (
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--accent)]" aria-label={`Sélectionner ${r.name}`} /></td>
                ) : null}
                <td className="px-4 py-3 font-medium"><Link href={`/app/agenda/rdv/${r.id}`} className="hover:underline">{r.name}</Link></td>
                <td className="px-4 py-3 text-muted">{r.service}</td>
                <td className="px-4 py-3 text-muted">{r.member}</td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.when}</td>
                <td className="px-4 py-3"><Badge tone={BADGE[r.state].tone}>{BADGE[r.state].label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
